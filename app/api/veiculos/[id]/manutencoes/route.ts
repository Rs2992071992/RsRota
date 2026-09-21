import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { manutencaoSchema } from "@/lib/validacao";

// POST /api/veiculos/[id]/manutencoes — cria uma manutenção para o veículo (só escritório).
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const veiculoId = Number(params.id);
  if (!Number.isInteger(veiculoId)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = manutencaoSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
  if (!existe) return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });

  const { descricao, km, data, valor, dias } = parsed.data;
  const manutencao = await prisma.manutencao.create({
    data: { veiculoId, descricao, km: km ?? null, data: new Date(data), valor: valor ?? null, dias: dias ?? null },
  });
  return NextResponse.json({ ok: true, manutencao }, { status: 201 });
}
