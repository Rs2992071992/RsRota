import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { veiculoSchema } from "@/lib/validacao";

// GET /api/veiculos — lista de veículos da frota (só escritório).
export async function GET() {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const veiculos = await prisma.veiculo.findMany({
    orderBy: { criadoEm: "asc" },
    include: {
      pneus: { orderBy: { ordem: "asc" } },
      _count: { select: { paragens: true } },
    },
  });
  return NextResponse.json({ veiculos });
}

// POST /api/veiculos — cria um veículo + os seus pneus (só escritório).
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = veiculoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { pneus, dataLimiteInspecao, ...dados } = parsed.data;

  const veiculo = await prisma.veiculo.create({
    data: {
      ...dados,
      dataLimiteInspecao: dataLimiteInspecao ? new Date(dataLimiteInspecao) : null,
      pneus: { create: pneus.map((p, i) => ({ eixo: p.eixo, custo: p.custo, km: p.km, ordem: i + 1 })) },
    },
    include: { pneus: { orderBy: { ordem: "asc" } } },
  });
  return NextResponse.json({ ok: true, veiculo }, { status: 201 });
}
