import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { alterarPinEscritorioSchema } from "@/lib/validacao";

// PATCH /api/auth/pin — o escritório muda o seu próprio PIN (exige o PIN atual).
export async function PATCH(req: Request) {
  const sessao = getSessaoInfo();
  if (!sessao || sessao.perfil !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = alterarPinEscritorioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const user = await prisma.utilizador.findUnique({ where: { id: sessao.id } });
  if (!user) return NextResponse.json({ erro: "Utilizador não encontrado." }, { status: 404 });

  if (!bcrypt.compareSync(parsed.data.pinAtual, user.pinHash)) {
    return NextResponse.json({ erro: "PIN atual incorreto." }, { status: 401 });
  }

  await prisma.utilizador.update({
    where: { id: user.id },
    data: { pinHash: bcrypt.hashSync(parsed.data.pinNovo, 10) },
  });
  return NextResponse.json({ ok: true });
}
