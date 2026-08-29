import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { alterarPinMotoristaSchema } from "@/lib/validacao";

// PATCH /api/motoristas/[id]/pin — escritório muda o PIN de um motorista.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = alterarPinMotoristaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const user = await prisma.utilizador.findUnique({ where: { id } });
  if (!user || user.perfil !== "MOTORISTA") {
    return NextResponse.json({ erro: "Motorista não encontrado." }, { status: 404 });
  }

  await prisma.utilizador.update({
    where: { id },
    data: { pinHash: bcrypt.hashSync(parsed.data.pin, 10) },
  });
  return NextResponse.json({ ok: true });
}
