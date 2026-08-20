import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { agruparClientesSchema } from "@/lib/validacao";

// POST /api/clientes/agrupar — funde variantes de nome de cliente num nome
// canónico (só escritório). Atualiza o histórico já existente (Paragem/Devis)
// e grava um alias por variante para que futuras importações normalizem
// automaticamente. Só toca no campo `cliente`/`nome` (string) — nunca em
// custo, receita, snapshot ou totais.
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = agruparClientesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { nomeCanonico } = parsed.data;
  const variantes = [...new Set(parsed.data.nomesVariantes.map((v) => v.trim()))].filter(
    (v) => v && v !== nomeCanonico,
  );
  if (variantes.length === 0) {
    return NextResponse.json({ erro: "Nada para agrupar." }, { status: 400 });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const pRes = await tx.paragem.updateMany({
      where: { cliente: { in: variantes } },
      data: { cliente: nomeCanonico },
    });
    const dRes = await tx.devis.updateMany({
      where: { cliente: { in: variantes } },
      data: { cliente: nomeCanonico },
    });

    for (const alias of variantes) {
      await tx.clienteAlias.upsert({
        where: { alias },
        create: { alias, clienteNome: nomeCanonico },
        update: { clienteNome: nomeCanonico },
      });
    }

    // Reconcilia as fichas de contacto: funde os dados das variantes na ficha
    // canónica (primeiro valor não-nulo encontrado vence) e remove as fichas
    // das variantes, já que esse nome deixa de ser um cliente autónomo.
    const fichasVariantes = await tx.cliente.findMany({ where: { nome: { in: variantes } } });
    if (fichasVariantes.length > 0) {
      const canonico = await tx.cliente.upsert({
        where: { nome: nomeCanonico },
        create: { nome: nomeCanonico },
        update: {},
      });
      const fundido = {
        contato: canonico.contato ?? fichasVariantes.find((f) => f.contato)?.contato ?? null,
        telefone: canonico.telefone ?? fichasVariantes.find((f) => f.telefone)?.telefone ?? null,
        email: canonico.email ?? fichasVariantes.find((f) => f.email)?.email ?? null,
        morada: canonico.morada ?? fichasVariantes.find((f) => f.morada)?.morada ?? null,
        notas: canonico.notas ?? fichasVariantes.find((f) => f.notas)?.notas ?? null,
        empresaId: canonico.empresaId ?? fichasVariantes.find((f) => f.empresaId)?.empresaId ?? null,
      };
      await tx.cliente.update({ where: { nome: nomeCanonico }, data: fundido });

      // Repontar pedidos de paletes das variantes para o cliente canónico
      // antes de apagar — PedidoPalete.clienteId é uma FK real a Cliente.id
      // (ao contrário de Paragem/Devis, que ligam por nome em string), pelo
      // que o deleteMany abaixo falharia (P2003) se alguma variante tivesse
      // pedidos associados.
      const idsVariantes = fichasVariantes.map((f) => f.id);
      await tx.pedidoPalete.updateMany({
        where: { clienteId: { in: idsVariantes } },
        data: { clienteId: canonico.id },
      });

      await tx.cliente.deleteMany({ where: { nome: { in: variantes } } });
    }

    return { paragensAtualizadas: pRes.count, orcamentosAtualizados: dRes.count };
  });

  return NextResponse.json({ ok: true, ...resultado });
}
