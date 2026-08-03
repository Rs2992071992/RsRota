import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { pedidoPaleteUpdateSchema } from "@/lib/validacao";

// PATCH /api/carregamentos/[id]/pedidos/[pedidoId] — corrige a quantidade de
// uma linha de pedido já registada (só escritório).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; pedidoId: string } },
) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  const pedidoId = Number(params.pedidoId);
  if (!Number.isInteger(carregamentoId) || !Number.isInteger(pedidoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pedidoPaleteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.pedidoPalete.findUnique({ where: { id: pedidoId } });
  if (!existe || existe.carregamentoId !== carregamentoId) {
    return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedidoPalete.update({
    where: { id: pedidoId },
    data: { quantidade: parsed.data.quantidade },
  });
  return NextResponse.json({ ok: true, pedido });
}

// DELETE /api/carregamentos/[id]/pedidos/[pedidoId] — remove uma linha de
// pedido (só escritório).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; pedidoId: string } },
) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentoId = Number(params.id);
  const pedidoId = Number(params.pedidoId);
  if (!Number.isInteger(carregamentoId) || !Number.isInteger(pedidoId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const existe = await prisma.pedidoPalete.findUnique({ where: { id: pedidoId } });
  if (!existe || existe.carregamentoId !== carregamentoId) {
    return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  }

  await prisma.pedidoPalete.delete({ where: { id: pedidoId } });
  return NextResponse.json({ ok: true });
}
