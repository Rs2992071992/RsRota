import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";

const n = z.number().finite();

const paramsSchema = z.object({
  salarioMensal: n,
  seguroMensal: n,
  percentEncargos: n,
  alimentacaoDia: n,
  diasAlimentacao: n,
  kmAnuais: n.positive(),
  fatorAnualizacao: n,
  valorAquisicao: n,
  valorResidual: n,
  vidaUtilAnos: n.positive(),
  iucAnual: n,
  taxaJuros: n,
  seguroAnual: n,
  reparacoesAnuais: n,
  revisaoAnual: n,
  inspecaoAnual: n,
  precoCombRef: n,
  precoCombReal: n,
  consumoAdblue: n,
  precoAdblue: n,
  margemMinima: n,
  valorHoraExtra: n,
  valorNoite: n,
  capacidadeCamiao: n.positive(),
  capacidadeReboque: n.positive(),
  capacidadePaleteA: n.positive(),
  capacidadePaleteB: n.positive(),
  capacidadePaleteACamiao: n.positive(),
  capacidadePaleteBCamiao: n.positive(),
});

const payloadSchema = z.object({
  params: paramsSchema,
  pneus: z.array(z.object({ eixo: z.string(), custo: n, km: n.positive() })),
  portagens: z.array(z.object({ zona: z.string().trim().min(1), valor: n })),
  consumo: z.array(z.object({ cargaKg: n, consumoL100: n })),
});

// PUT /api/parametros — guarda parâmetros + tabelas (só escritório), transacional.
export async function PUT(req: Request) {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { params, pneus, portagens, consumo } = parsed.data;

  await prisma.$transaction([
    prisma.parametros.update({ where: { id: 1 }, data: params }),
    // Apenas os pneus "globais" (template/fallback). Os pneus por-veículo são geridos
    // na página de Veículos e não devem ser apagados aqui.
    prisma.pneu.deleteMany({ where: { veiculoId: null } }),
    prisma.pneu.createMany({
      data: pneus.map((p, i) => ({ eixo: p.eixo, custo: p.custo, km: p.km, ordem: i + 1, veiculoId: null })),
    }),
    prisma.tabelaPortagem.deleteMany({}),
    prisma.tabelaPortagem.createMany({ data: portagens }),
    prisma.tabelaConsumo.deleteMany({}),
    prisma.tabelaConsumo.createMany({ data: consumo }),
  ]);

  return NextResponse.json({ ok: true });
}
