import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createSessionValue } from "@/lib/auth";

const schema = z.object({
  perfil: z.enum(["ESCRITORIO", "MOTORISTA"]),
  // Só para motorista (ID de login). Escritório não usa.
  codigo: z.string().trim().optional(),
  pin: z.string().min(1),
});

// Proteção contra força bruta do PIN: ao fim de N falhas seguidas na mesma
// conta, bloqueia-a durante um período — mesmo um PIN de 4 dígitos (10 000
// combinações) deixa de ser viável de adivinhar por tentativa e erro.
const LIMITE_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  const { perfil, codigo, pin } = parsed.data;

  // Escritório: conta única (codigo fixo). Motorista: procura pelo ID introduzido.
  const codigoLogin = perfil === "ESCRITORIO" ? "ESCRITORIO" : (codigo ?? "").trim();
  if (perfil === "MOTORISTA" && !codigoLogin) {
    return NextResponse.json({ erro: "Indique o seu ID." }, { status: 400 });
  }

  const user = await prisma.utilizador.findUnique({ where: { codigo: codigoLogin } });

  if (user?.bloqueadoAte && user.bloqueadoAte > new Date()) {
    const minutos = Math.ceil((user.bloqueadoAte.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { erro: `Demasiadas tentativas falhadas. Tente novamente daqui a ${minutos} min.` },
      { status: 429 },
    );
  }

  if (!user || user.perfil !== perfil || !bcrypt.compareSync(pin, user.pinHash)) {
    if (user) {
      const tentativas = user.tentativasFalhadas + 1;
      const atingiuLimite = tentativas >= LIMITE_TENTATIVAS;
      await prisma.utilizador.update({
        where: { id: user.id },
        data: {
          tentativasFalhadas: atingiuLimite ? 0 : tentativas,
          bloqueadoAte: atingiuLimite ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60000) : null,
        },
      });
    }
    return NextResponse.json(
      { erro: perfil === "MOTORISTA" ? "ID ou PIN incorretos." : "PIN incorreto." },
      { status: 401 },
    );
  }

  if (user.tentativasFalhadas > 0 || user.bloqueadoAte) {
    await prisma.utilizador.update({
      where: { id: user.id },
      data: { tentativasFalhadas: 0, bloqueadoAte: null },
    });
  }

  const res = NextResponse.json({
    ok: true,
    destino: perfil === "ESCRITORIO" ? "/escritorio/dashboard" : "/motorista/registo",
    // Para apps nativas (origem diferente do site, ex. Motorista offline): mesma
    // credencial da cookie, mas para guardar em storage seguro e enviar como
    // "Authorization: Bearer <token>". O browser ignora este campo.
    token: createSessionValue(perfil, user.id),
  });
  res.cookies.set(SESSION_COOKIE, createSessionValue(perfil, user.id), {
    httpOnly: true,
    // Nunca enviar a cookie de sessão por HTTP simples (só https) em produção.
    // Em dev (localhost) fica false — Secure exige https, que não há em localhost
    // em todos os browsers, e não há nada sensível em jogo em desenvolvimento.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 horas
  });
  return res;
}
