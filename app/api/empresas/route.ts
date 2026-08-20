import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao, getSessaoInfo } from "@/lib/session";
import { empresaSchema } from "@/lib/validacao";

// GET /api/empresas — lista as empresas-mãe (qualquer sessão autenticada).
export async function GET() {
  if (!getSessaoInfo()) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const empresas = await prisma.empresa.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json({ empresas });
}

// POST /api/empresas — cria uma empresa-mãe nova (só escritório).
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = empresaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const existe = await prisma.empresa.findUnique({ where: { nome: parsed.data.nome } });
  if (existe) return NextResponse.json({ erro: "Já existe uma empresa com esse nome." }, { status: 409 });

  const empresa = await prisma.empresa.create({ data: { nome: parsed.data.nome } });
  return NextResponse.json({ ok: true, empresa }, { status: 201 });
}
