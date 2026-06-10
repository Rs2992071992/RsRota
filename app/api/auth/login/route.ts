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
  if (!user || user.perfil !== perfil || !bcrypt.compareSync(pin, user.pinHash)) {
    return NextResponse.json(
      { erro: perfil === "MOTORISTA" ? "ID ou PIN incorretos." : "PIN incorreto." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    destino: perfil === "ESCRITORIO" ? "/escritorio/dashboard" : "/motorista/registo",
  });
  res.cookies.set(SESSION_COOKIE, createSessionValue(perfil, user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 horas
  });
  return res;
}
