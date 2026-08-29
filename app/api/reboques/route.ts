import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { reboqueSchema } from "@/lib/validacao";

// GET /api/reboques — catálogo de reboques (só escritório). Inclui inativos.
export async function GET() {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const reboques = await prisma.reboque.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json({ reboques });
}

// POST /api/reboques — cria um novo reboque (só escritório).
export async function POST(req: Request) {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = reboqueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const reboque = await prisma.reboque.create({ data: parsed.data });
  return NextResponse.json({ ok: true, reboque }, { status: 201 });
}
