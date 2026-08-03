import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { reboqueUpdateSchema } from "@/lib/validacao";
import { ehErroFkRestricao } from "@/lib/prisma-errors";

// PATCH /api/reboques/[id] — atualiza um reboque (só escritório).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = reboqueUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.reboque.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Reboque não encontrado." }, { status: 404 });

  const reboque = await prisma.reboque.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true, reboque });
}

// DELETE /api/reboques/[id] — apaga um reboque (só escritório). Se estiver
// associado a carregamentos (mesmo históricos, via onDelete: SetNull), o
// próprio Prisma não bloqueia — mas sugerimos desativar para não perder as
// dimensões usadas em cargas antigas já fechadas.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.reboque.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Reboque não encontrado." }, { status: 404 });

  try {
    await prisma.reboque.delete({ where: { id } });
  } catch (e) {
    if (ehErroFkRestricao(e)) {
      return NextResponse.json(
        { erro: "Este reboque está associado a carregamentos. Desative-o em vez de apagar." },
        { status: 409 },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
