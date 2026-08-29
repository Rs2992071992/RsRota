import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { veiculoSchema } from "@/lib/validacao";
import { ehErroFkRestricao } from "@/lib/prisma-errors";

// PATCH /api/veiculos/[id] — atualiza um veículo + substitui os seus pneus.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = veiculoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { pneus, dataLimiteInspecao, inspecaoVerificada, ...dados } = parsed.data;

  const existe = await prisma.veiculo.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });

  // Mudar o prazo de inspeção para uma data diferente da gravada reabre o aviso
  // ao motorista — a verificação anterior não se aplica a um prazo novo.
  const novaDataLimiteInspecao = dataLimiteInspecao ? new Date(dataLimiteInspecao) : null;
  const prazoMudou =
    (existe.dataLimiteInspecao?.getTime() ?? null) !== (novaDataLimiteInspecao?.getTime() ?? null);

  await prisma.$transaction([
    prisma.veiculo.update({
      where: { id },
      data: {
        ...dados,
        dataLimiteInspecao: novaDataLimiteInspecao,
        inspecaoVerificada: prazoMudou ? false : (inspecaoVerificada ?? existe.inspecaoVerificada),
      },
    }),
    prisma.pneu.deleteMany({ where: { veiculoId: id } }),
    prisma.pneu.createMany({
      data: pneus.map((p, i) => ({ veiculoId: id, eixo: p.eixo, custo: p.custo, km: p.km, ordem: i + 1 })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}

// DELETE /api/veiculos/[id] — apaga um veículo. As paragens ficam com veiculoId
// null (o snapshot congelado preserva os custos históricos).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.veiculo.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });

  try {
    await prisma.veiculo.delete({ where: { id } });
  } catch (e) {
    if (ehErroFkRestricao(e)) {
      return NextResponse.json(
        { erro: "Não é possível apagar: há carregamentos associados a este veículo." },
        { status: 409 },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
