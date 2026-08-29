import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { carregamentoSchema } from "@/lib/validacao";

// GET /api/carregamentos — lista de carregamentos (só escritório), abertos primeiro.
export async function GET() {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const carregamentos = await prisma.carregamento.findMany({
    orderBy: [{ estado: "asc" }, { data: "desc" }],
    include: {
      veiculo: { select: { nome: true, matricula: true } },
      reboque: { select: { nome: true } },
      _count: { select: { pedidos: true } },
    },
  });
  return NextResponse.json({ carregamentos });
}

// POST /api/carregamentos — cria um novo carregamento para um veículo (só escritório).
export async function POST(req: Request) {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = carregamentoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { veiculoId, data, notas } = parsed.data;
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
  if (!veiculo) return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });

  const carregamento = await prisma.carregamento.create({
    data: {
      veiculoId,
      notas: notas ?? null,
      ...(data ? { data: new Date(data) } : {}),
    },
  });
  return NextResponse.json({ ok: true, carregamento }, { status: 201 });
}
