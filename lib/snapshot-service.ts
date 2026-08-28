import { prisma } from "@/lib/db";
import {
  calcularSnapshot,
  type MotoristaParams,
  type VeiculoCaixa,
  type VeiculoParams,
} from "@/lib/calc/snapshot";
import type { ParagemSnapshot, ParametrosCusto, PneuItem } from "@/lib/calc/types";
import type { Pneu, Reboque, Utilizador, Veiculo } from "@prisma/client";

type VeiculoComPneus = Veiculo & { pneus: Pneu[]; reboqueHabitual: Reboque | null };

const toPneuItem = (p: Pneu): PneuItem => ({ custo: p.custo, km: p.km });

/** Extrai os 7 campos salariais de um motorista (ou null para usar os defaults). */
function motoristaParams(u: Utilizador | null): MotoristaParams | null {
  if (!u) return null;
  return {
    salarioMensal: u.salarioMensal,
    seguroMensal: u.seguroMensal,
    percentEncargos: u.percentEncargos,
    alimentacaoDia: u.alimentacaoDia,
    diasAlimentacao: u.diasAlimentacao,
    kmAnuais: u.kmAnuais,
    fatorAnualizacao: u.fatorAnualizacao,
  };
}

/** Extrai os campos de custo de um veículo (ou null para usar os defaults). */
function veiculoParams(v: Veiculo | null): VeiculoParams | null {
  if (!v) return null;
  return {
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
  };
}

/** Parâmetros globais (singleton) + pneus-template para o fallback. */
export interface BaseSnapshot {
  base: ParametrosCusto;
  pneusGlobais: PneuItem[];
}

export async function carregarBaseSnapshot(): Promise<BaseSnapshot> {
  const [base, pneus] = await Promise.all([
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.pneu.findMany({ where: { veiculoId: null }, orderBy: { ordem: "asc" } }),
  ]);
  if (!base) throw new Error("Parâmetros não inicializados. Corra `npm run db:seed`.");
  return { base: base as ParametrosCusto, pneusGlobais: pneus.map(toPneuItem) };
}

/**
 * Caixa de carga (mm) do veículo + do seu reboque habitual, e o fator de
 * ocupação — ver `lib/calc/snapshot.ts::VeiculoCaixa`. Não fazem parte de
 * `VeiculoParams` (não há default global em Parametros).
 */
function veiculoCaixa(v: VeiculoComPneus | null): VeiculoCaixa | null {
  if (!v) return null;
  return {
    caixaComprimentoMm: v.caixaComprimentoMm,
    caixaLarguraMm: v.caixaLarguraMm,
    caixaReboqueComprimentoMm: v.reboqueHabitual?.comprimentoMm ?? null,
    caixaReboqueLarguraMm: v.reboqueHabitual?.larguraMm ?? null,
    fatorOcupacaoPalete: v.fatorOcupacaoPalete,
  };
}

/** Snapshot a partir das entidades já carregadas (motorista/veículo incluídos). */
export function snapshotDeEntidades(
  { base, pneusGlobais }: BaseSnapshot,
  motorista: Utilizador | null,
  veiculo: VeiculoComPneus | null,
): ParagemSnapshot {
  const pneus = veiculo && veiculo.pneus.length > 0 ? veiculo.pneus.map(toPneuItem) : pneusGlobais;
  return calcularSnapshot(base, motoristaParams(motorista), veiculoParams(veiculo), pneus, veiculoCaixa(veiculo));
}

/**
 * Calcula o snapshot a congelar no momento de criar/editar uma paragem, dados os
 * IDs do motorista e do veículo. Usado pelas rotas de escrita (/api/paragens).
 */
export async function snapshotParaRegisto(
  motoristaId: number | null,
  veiculoId: number | null,
): Promise<ParagemSnapshot> {
  const baseSnap = await carregarBaseSnapshot();
  const [motorista, veiculo] = await Promise.all([
    motoristaId ? prisma.utilizador.findUnique({ where: { id: motoristaId } }) : null,
    veiculoId
      ? prisma.veiculo.findUnique({
          where: { id: veiculoId },
          include: { pneus: { orderBy: { ordem: "asc" } }, reboqueHabitual: true },
        })
      : null,
  ]);
  return snapshotDeEntidades(baseSnap, motorista, veiculo);
}
