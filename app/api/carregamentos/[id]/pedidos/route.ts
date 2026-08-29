import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { pedidoPaleteSchema } from "@/lib/validacao";
import { carregarCarregamento } from "@/lib/carregamento-service";

// POST /api/carregamentos/[id]/pedidos — adiciona uma linha de pedido
// (cliente + tipo de palete + quantidade) a um carregamento (só escritório).
// Grava SEMPRE a linha, mesmo que não caiba fisicamente no espaço disponível
// (o compromisso ao telefone já foi feito) — a resposta indica o overflow e
// sugestões de reboque para a UI assinalar, sem bloquear o registo.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  if (!Number.isInteger(carregamentoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pedidoPaleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const carregamento = await prisma.carregamento.findUnique({ where: { id: carregamentoId } });
  if (!carregamento) {
    return NextResponse.json({ erro: "Carregamento não encontrado." }, { status: 404 });
  }

  const { clienteId, tipoPaleteId, quantidade } = parsed.data;
  const [cliente, tipoPalete] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId } }),
    prisma.tipoPalete.findUnique({ where: { id: tipoPaleteId } }),
  ]);
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  if (!tipoPalete) {
    return NextResponse.json({ erro: "Tipo de palete não encontrado." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const agregado = await tx.pedidoPalete.aggregate({
      where: { carregamentoId },
      _max: { ordem: true },
    });
    await tx.pedidoPalete.create({
      data: {
        carregamentoId,
        clienteId,
        tipoPaleteId,
        quantidade,
        ordem: (agregado._max.ordem ?? 0) + 1,
      },
    });
  });

  const detalhe = await carregarCarregamento(carregamentoId);
  const overflow = (detalhe?.packing.naoColocados.length ?? 0) > 0;
  return NextResponse.json(
    { ok: true, overflow, sugestoesReboque: detalhe?.sugestoesReboque ?? null, carregamento: detalhe },
    { status: 201 },
  );
}
