import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { reordenarPedidosSchema } from "@/lib/validacao";
import { carregarCarregamento } from "@/lib/carregamento-service";

// PATCH /api/carregamentos/[id]/pedidos/ordem — reordena a sequência de carga
// (só escritório). O corpo tem de conter EXATAMENTE os pedidos deste
// carregamento (mesmo conjunto, sem repetidos), na ordem pretendida.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if ((await getSessao()) !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  if (!Number.isInteger(carregamentoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reordenarPedidosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.carregamento.findUnique({ where: { id: carregamentoId } });
  if (!existe) {
    return NextResponse.json({ erro: "Carregamento não encontrado." }, { status: 404 });
  }

  const pedidos = await prisma.pedidoPalete.findMany({
    where: { carregamentoId },
    select: { id: true },
  });
  const idsReais = new Set(pedidos.map((p) => p.id));
  const { ordemPedidoIds } = parsed.data;
  const idsUnicos = new Set(ordemPedidoIds);

  if (
    ordemPedidoIds.length !== idsReais.size ||
    idsUnicos.size !== ordemPedidoIds.length ||
    ordemPedidoIds.some((pid) => !idsReais.has(pid))
  ) {
    return NextResponse.json(
      { erro: "A ordem tem de conter exatamente os pedidos deste carregamento." },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    ordemPedidoIds.map((pedidoId, i) =>
      prisma.pedidoPalete.update({ where: { id: pedidoId }, data: { ordem: i + 1 } }),
    ),
  );

  const detalhe = await carregarCarregamento(carregamentoId);
  return NextResponse.json({ ok: true, carregamento: detalhe });
}
