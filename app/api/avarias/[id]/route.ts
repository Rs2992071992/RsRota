import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { avariaUpdateSchema } from "@/lib/validacao";

// PATCH /api/avarias/[id] — atualiza descrição/data/estado (só escritório).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = avariaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.avaria.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Avaria não encontrada." }, { status: 404 });

  const { descricao, data, resolvida } = parsed.data;
  const avaria = await prisma.avaria.update({
    where: { id },
    data: {
      ...(descricao !== undefined && { descricao }),
      ...(data !== undefined && { data: new Date(data) }),
      ...(resolvida !== undefined && {
        resolvida,
        resolvidaEm: resolvida ? new Date() : null,
      }),
    },
  });
  return NextResponse.json({ ok: true, avaria });
}

// DELETE /api/avarias/[id] — apaga uma avaria (só escritório).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.avaria.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Avaria não encontrada." }, { status: 404 });

  await prisma.avaria.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
