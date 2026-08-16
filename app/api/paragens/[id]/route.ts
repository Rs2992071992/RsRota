import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { paragemSchema } from "@/lib/validacao";
import { snapshotParaRegisto } from "@/lib/snapshot-service";

// Atualização parcial — usada para editar a receita (escritório) ou corrigir uma
// paragem (escritório, ou o próprio motorista nas suas paragens).
const patchSchema = paragemSchema.innerType().partial();

/**
 * Verifica permissão sobre uma paragem: escritório pode tudo; um motorista só
 * pode mexer nas paragens que ele próprio registou. Devolve a paragem ou null.
 */
async function paragemAutorizada(id: number) {
  const sessao = getSessaoInfo();
  if (!sessao) return { erro: 401 as const, paragem: null, sessao: null };
  const paragem = await prisma.paragem.findUnique({ where: { id } });
  if (!paragem) return { erro: 404 as const, paragem: null, sessao: null };
  if (sessao.perfil === "ESCRITORIO") return { erro: null, paragem, sessao };
  if (sessao.perfil === "MOTORISTA" && paragem.motoristaId === sessao.id) {
    return { erro: null, paragem, sessao };
  }
  return { erro: 403 as const, paragem: null, sessao: null };
}

/**
 * Campos de faturação/cobrança — decisão do escritório, nunca do motorista
 * (mesmo que a paragem seja dele). A UI já os esconde do motorista, mas isso
 * é só cosmético: sem este filtro, um PATCH direto (fora da UI) conseguia
 * alterá-los à mesma.
 */
const CAMPOS_ESCRITORIO = ["pago", "dataPagamento", "receitaPaga", "faturarCliente"] as const;

// PATCH /api/paragens/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const auth = await paragemAutorizada(id);
  if (auth.erro) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: auth.erro });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  if (auth.sessao?.perfil !== "ESCRITORIO") {
    for (const campo of CAMPOS_ESCRITORIO) delete d[campo];
  }
  const data: Record<string, unknown> = { ...d };
  if (d.data) data.data = new Date(d.data);
  if (d.faturarCliente !== undefined) data.faturarCliente = d.faturarCliente?.trim() || null;

  // Estado de cobrança: ao marcar pago sem data, regista a data de hoje; ao desmarcar,
  // limpa a data de pagamento.
  if (d.pago !== undefined) {
    if (d.pago) {
      data.dataPagamento = d.dataPagamento ? new Date(d.dataPagamento) : new Date();
    } else {
      data.dataPagamento = null;
    }
  } else if (d.dataPagamento !== undefined) {
    data.dataPagamento = d.dataPagamento ? new Date(d.dataPagamento) : null;
  }

  // Só recongela o snapshot (gel dos custos) se o veículo mudou — caso contrário um
  // simples toggle "Pago" re-congelaria os custos aos parâmetros de hoje (histórico
  // estável; ver lição snapshot em tasks/lessons.md).
  if (d.veiculoId !== undefined && d.veiculoId !== auth.paragem.veiculoId) {
    const snapshot = await snapshotParaRegisto(auth.paragem.motoristaId, d.veiculoId);
    data.snapshot = snapshot as unknown as Prisma.InputJsonValue;
  }

  const atualizada = await prisma.paragem.update({ where: { id }, data });
  return NextResponse.json({ ok: true, paragem: atualizada });
}

// DELETE /api/paragens/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const auth = await paragemAutorizada(id);
  if (auth.erro) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: auth.erro });
  }

  await prisma.paragem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
