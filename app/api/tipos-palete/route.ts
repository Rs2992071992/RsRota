import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { tipoPaleteSchema } from "@/lib/validacao";

// GET /api/tipos-palete — catálogo de tipos de palete (só escritório). Inclui
// inativos para que o editor de Parâmetros os possa reativar.
export async function GET() {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const tiposPalete = await prisma.tipoPalete.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json({ tiposPalete });
}

// POST /api/tipos-palete — cria um novo tipo de palete (só escritório).
export async function POST(req: Request) {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = tipoPaleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const tipoPalete = await prisma.tipoPalete.create({ data: parsed.data });
  return NextResponse.json({ ok: true, tipoPalete }, { status: 201 });
}
