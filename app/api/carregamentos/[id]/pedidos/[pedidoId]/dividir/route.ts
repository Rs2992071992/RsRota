import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { dividirPedidoSchema } from "@/lib/validacao";
import { carregarCarregamento } from "@/lib/carregamento-service";

// POST /api/carregamentos/[id]/pedidos/[pedidoId]/dividir — só escritório.
// Separa `quantidade` paletes desta linha para uma linha nova (mesmo cliente e
// tipo de palete), colocada logo a seguir, para lhes dar orientações
// diferentes. A ordem de carga é renumerada sequencialmente.
export async function POST(req: Request, props: { params: Promise<{ id: string; pedidoId: string }> }) {
  const params = await props.params;
  if ((await getSessao()) !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  const pedidoId = Number(params.pedidoId);
  if (!Number.isInteger(carregamentoId) || !Number.isInteger(pedidoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = dividirPedidoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pedido = await prisma.pedidoPalete.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.carregamentoId !== carregamentoId) {
    return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  }

  const { quantidade } = parsed.data;
  if (quantidade >= pedido.quantidade) {
    return NextResponse.json(
      { erro: `Só pode separar até ${pedido.quantidade - 1} palete(s).` },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.pedidoPalete.update({
      where: { id: pedidoId },
      data: { quantidade: pedido.quantidade - quantidade },
    });
    await tx.pedidoPalete.create({
      data: {
        carregamentoId,
        clienteId: pedido.clienteId,
        tipoPaleteId: pedido.tipoPaleteId,
        orientacao: pedido.orientacao,
        quantidade,
        ordem: pedido.ordem, // fica logo a seguir à original (id maior desempata)
      },
    });
    // Renumera a sequência de carga: 1, 2, 3, … por (ordem, id).
    const todos = await tx.pedidoPalete.findMany({
      where: { carregamentoId },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    for (let i = 0; i < todos.length; i++) {
      await tx.pedidoPalete.update({ where: { id: todos[i].id }, data: { ordem: i + 1 } });
    }
  });

  const detalhe = await carregarCarregamento(carregamentoId);
  return NextResponse.json({ ok: true, carregamento: detalhe });
}
