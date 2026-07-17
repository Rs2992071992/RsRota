import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { manutencaoUpdateSchema } from "@/lib/validacao";

// PATCH /api/manutencoes/[id] — atualiza campos de uma manutenção (só escritório).
// Permite preencher `valor`/`dias` mais tarde, quando se souberem.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = manutencaoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.manutencao.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Manutenção não encontrada." }, { status: 404 });

  const { descricao, data, valor, dias } = parsed.data;
  const manutencao = await prisma.manutencao.update({
    where: { id },
    data: {
      ...(descricao !== undefined && { descricao }),
      ...(data !== undefined && { data: new Date(data) }),
      ...(valor !== undefined && { valor }),
      ...(dias !== undefined && { dias }),
    },
  });
  return NextResponse.json({ ok: true, manutencao });
}

// DELETE /api/manutencoes/[id] — apaga uma manutenção (só escritório).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.manutencao.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Manutenção não encontrada." }, { status: 404 });

  await prisma.manutencao.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
