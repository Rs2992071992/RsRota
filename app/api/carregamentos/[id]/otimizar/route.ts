import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { carregarCarregamento, simularOrdemOtimizada } from "@/lib/carregamento-service";

// POST /api/carregamentos/[id]/otimizar — só escritório.
//   sem body / { aplicar: false } -> devolve a simulação (ordem sugerida + ganho),
//                                    sem tocar nos dados.
//   { aplicar: true }             -> reescreve `PedidoPalete.ordem` pela ordem
//                                    sugerida e devolve o carregamento recalculado.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if ((await getSessao()) !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  if (!Number.isInteger(carregamentoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const aplicar = body?.aplicar === true;

  const simulacao = await simularOrdemOtimizada(carregamentoId);
  if (!simulacao) {
    return NextResponse.json({ erro: "Carregamento não encontrado." }, { status: 404 });
  }

  if (!aplicar || simulacao.jaOtima) {
    return NextResponse.json({ ok: true, aplicado: false, simulacao });
  }

  await prisma.$transaction(
    simulacao.pedidoIdsOrdenados.map((pedidoId, i) =>
      prisma.pedidoPalete.update({ where: { id: pedidoId }, data: { ordem: i + 1 } }),
    ),
  );

  const detalhe = await carregarCarregamento(carregamentoId);
  return NextResponse.json({ ok: true, aplicado: true, carregamento: detalhe });
}
