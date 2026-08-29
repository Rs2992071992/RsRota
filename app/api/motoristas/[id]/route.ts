import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { motoristaParamsSchema } from "@/lib/validacao";

// PATCH /api/motoristas/[id] — edita os parâmetros salariais de um motorista
// (só escritório). Não afeta paragens já registadas (snapshot congelado).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = motoristaParamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await prisma.utilizador.findUnique({ where: { id } });
  if (!user || user.perfil !== "MOTORISTA") {
    return NextResponse.json({ erro: "Motorista não encontrado." }, { status: 404 });
  }

  await prisma.utilizador.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/motoristas/[id] — apaga um motorista (só escritório).
// As paragens dele ficam com motoristaId = null (não se apagam dados).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const user = await prisma.utilizador.findUnique({ where: { id } });
  if (!user || user.perfil !== "MOTORISTA") {
    return NextResponse.json({ erro: "Motorista não encontrado." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.paragem.updateMany({ where: { motoristaId: id }, data: { motoristaId: null } }),
    prisma.utilizador.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
