import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { alterarPinProprioSchema } from "@/lib/validacao";
import { SESSION_COOKIE, TTL_COOKIE_SEG, TTL_TOKEN_APP_SEG, createSessionValue } from "@/lib/auth";

// PATCH /api/auth/pin — qualquer utilizador autenticado (escritório ou
// motorista) muda o seu próprio PIN (exige o PIN atual).
export async function PATCH(req: Request) {
  const sessao = await getSessaoInfo();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = alterarPinProprioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const user = await prisma.utilizador.findUnique({ where: { id: sessao.id } });
  if (!user) return NextResponse.json({ erro: "Utilizador não encontrado." }, { status: 404 });

  if (!bcrypt.compareSync(parsed.data.pinAtual, user.pinHash)) {
    return NextResponse.json({ erro: "PIN atual incorreto." }, { status: 400 });
  }

  // Sobe a versão: todas as sessões/tokens antigos (incl. copiados) deixam de
  // valer. A sessão de quem mudou o PIN é renovada na própria resposta.
  const atualizado = await prisma.utilizador.update({
    where: { id: user.id },
    data: { pinHash: bcrypt.hashSync(parsed.data.pinNovo, 10), sessaoVersao: { increment: 1 } },
  });
  const res = NextResponse.json({
    ok: true,
    token: createSessionValue(sessao.perfil, user.id, atualizado.sessaoVersao, TTL_TOKEN_APP_SEG),
  });
  res.cookies.set(SESSION_COOKIE, createSessionValue(sessao.perfil, user.id, atualizado.sessaoVersao, TTL_COOKIE_SEG), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_COOKIE_SEG,
  });
  return res;
}
