import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";

const registoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, "O ID deve ter pelo menos 2 caracteres.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use só letras, números, ponto, hífen ou underscore."),
  nome: z.string().trim().optional(),
  pin: z.string().trim().min(4, "O PIN deve ter pelo menos 4 dígitos."),
});

// POST /api/motoristas — cria um motorista (aberto, a partir da página de login).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { codigo, nome, pin } = parsed.data;

  if (codigo.toUpperCase() === "ESCRITORIO") {
    return NextResponse.json({ erro: "Esse ID é reservado." }, { status: 400 });
  }
  const existe = await prisma.utilizador.findUnique({ where: { codigo } });
  if (existe) {
    return NextResponse.json({ erro: "Já existe um motorista com esse ID." }, { status: 409 });
  }

  await prisma.utilizador.create({
    data: {
      codigo,
      nome: nome || null,
      perfil: "MOTORISTA",
      pinHash: bcrypt.hashSync(pin, 10),
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/motoristas — lista motoristas (só escritório).
export async function GET() {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const motoristas = await prisma.utilizador.findMany({
    where: { perfil: "MOTORISTA" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      criadoEm: true,
      _count: { select: { paragens: true } },
    },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json({ motoristas });
}
