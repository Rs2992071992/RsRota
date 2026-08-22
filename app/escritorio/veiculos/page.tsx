import { prisma } from "@/lib/db";
import VeiculosManager, { type VeiculoBD } from "./VeiculosManager";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const [veiculos, params, pneusGlobais, avariasPendentes] = await Promise.all([
    prisma.veiculo.findMany({
      orderBy: { criadoEm: "asc" },
      include: {
        pneus: { orderBy: { ordem: "asc" } },
        manutencoes: { orderBy: { data: "desc" } },
        _count: { select: { paragens: true } },
      },
    }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.pneu.findMany({ where: { veiculoId: null }, orderBy: { ordem: "asc" } }),
    prisma.avaria.count({ where: { resolvida: false } }),
  ]);

  // Template (valores por defeito) para pré-preencher um veículo novo.
  const template = {
    nome: "",
    matricula: "",
    valorAquisicao: params?.valorAquisicao ?? 127000,
    valorResidual: params?.valorResidual ?? 88000,
    vidaUtilAnos: params?.vidaUtilAnos ?? 3,
    iucAnual: params?.iucAnual ?? 600,
    taxaJuros: params?.taxaJuros ?? 0.02,
    seguroAnual: params?.seguroAnual ?? 4000,
    reparacoesAnuais: params?.reparacoesAnuais ?? 1500,
    revisaoAnual: params?.revisaoAnual ?? 1200,
    inspecaoAnual: params?.inspecaoAnual ?? 100,
    capacidadeCamiao: params?.capacidadeCamiao ?? 14000,
    capacidadeReboque: params?.capacidadeReboque ?? 24000,
    capacidadePaleteA: params?.capacidadePaleteA ?? 38,
    capacidadePaleteB: params?.capacidadePaleteB ?? 28,
    capacidadePaleteACamiao: params?.capacidadePaleteACamiao ?? 18,
    capacidadePaleteBCamiao: params?.capacidadePaleteBCamiao ?? 14,
    pneus: pneusGlobais.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km })),
  };

  const lista: VeiculoBD[] = veiculos.map((v) => ({
    id: v.id,
    nome: v.nome,
    matricula: v.matricula,
    ativo: v.ativo,
    valorAquisicao: v.valorAquisicao,
    valorResidual: v.valorResidual,
    vidaUtilAnos: v.vidaUtilAnos,
    iucAnual: v.iucAnual,
    taxaJuros: v.taxaJuros,
    seguroAnual: v.seguroAnual,
    reparacoesAnuais: v.reparacoesAnuais,
    revisaoAnual: v.revisaoAnual,
    inspecaoAnual: v.inspecaoAnual,
    capacidadeCamiao: v.capacidadeCamiao,
    capacidadeReboque: v.capacidadeReboque,
    capacidadePaleteA: v.capacidadePaleteA,
    capacidadePaleteB: v.capacidadePaleteB,
    capacidadePaleteACamiao: v.capacidadePaleteACamiao,
    capacidadePaleteBCamiao: v.capacidadePaleteBCamiao,
    nParagens: v._count.paragens,
    pneus: v.pneus.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km })),
    manutencoes: v.manutencoes.map((m) => ({
      id: m.id,
      descricao: m.descricao,
      data: m.data.toISOString(),
      valor: m.valor,
      dias: m.dias,
    })),
  }));

  return <VeiculosManager veiculos={lista} template={template} avariasPendentes={avariasPendentes} />;
}
