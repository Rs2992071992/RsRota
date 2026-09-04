import { prisma } from "@/lib/db";
import VeiculosManager, { type VeiculoBD } from "./VeiculosManager";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const [veiculos, params, pneusGlobais, avariasPendentes, reboques] = await Promise.all([
    prisma.veiculo.findMany({
      orderBy: { criadoEm: "asc" },
      include: {
        pneus: { orderBy: { ordem: "asc" } },
        consumoTabela: { orderBy: { cargaKg: "asc" } },
        manutencoes: { orderBy: { data: "desc" } },
        _count: { select: { paragens: true } },
      },
    }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.pneu.findMany({ where: { veiculoId: null }, orderBy: { ordem: "asc" } }),
    prisma.avaria.count({ where: { resolvida: false } }),
    prisma.reboque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  // Template (valores por defeito) para pré-preencher um veículo novo.
  const template = {
    nome: "",
    matricula: "",
    categoria: "PESADO" as const,
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
    caixaComprimentoMm: null,
    caixaLarguraMm: null,
    reboqueHabitualId: null,
    fatorOcupacaoPalete: 1,
    pneus: pneusGlobais.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km })),
    consumo: [],
  };

  const lista: VeiculoBD[] = veiculos.map((v) => ({
    id: v.id,
    nome: v.nome,
    matricula: v.matricula,
    ativo: v.ativo,
    categoria: v.categoria as "LIGEIRO" | "PESADO",
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
    caixaComprimentoMm: v.caixaComprimentoMm,
    caixaLarguraMm: v.caixaLarguraMm,
    reboqueHabitualId: v.reboqueHabitualId,
    fatorOcupacaoPalete: v.fatorOcupacaoPalete,
    nParagens: v._count.paragens,
    pneus: v.pneus.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km })),
    consumo: v.consumoTabela.map((c) => ({ cargaKg: c.cargaKg, consumoL100: c.consumoL100 })),
    manutencoes: v.manutencoes.map((m) => ({
      id: m.id,
      descricao: m.descricao,
      data: m.data.toISOString(),
      valor: m.valor,
      dias: m.dias,
    })),
  }));

  return (
    <VeiculosManager
      veiculos={lista}
      template={template}
      avariasPendentes={avariasPendentes}
      reboques={reboques}
    />
  );
}
