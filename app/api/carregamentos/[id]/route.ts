import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { carregamentoUpdateSchema } from "@/lib/validacao";

// PATCH /api/carregamentos/[id] — anexar/trocar/remover reboque (reboqueId),
// fechar/reabrir (estado) e/ou atualizar notas (só escritório).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = carregamentoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.carregamento.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Carregamento não encontrado." }, { status: 404 });

  const { estado, reboqueId, notas } = parsed.data;
  if (reboqueId != null) {
    const reboque = await prisma.reboque.findUnique({ where: { id: reboqueId } });
    if (!reboque) return NextResponse.json({ erro: "Reboque não encontrado." }, { status: 404 });
  }

  const carregamento = await prisma.carregamento.update({
    where: { id },
    data: {
      ...(estado !== undefined && { estado }),
      ...(reboqueId !== undefined && { reboqueId }),
      ...(notas !== undefined && { notas }),
    },
  });
  return NextResponse.json({ ok: true, carregamento });
}

// DELETE /api/carregamentos/[id] — apaga o carregamento e os seus pedidos (cascata).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.carregamento.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Carregamento não encontrado." }, { status: 404 });

  await prisma.carregamento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
