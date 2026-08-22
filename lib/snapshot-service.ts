import { prisma } from "@/lib/db";
import {
  calcularSnapshot,
  type MotoristaParams,
  type VeiculoParams,
} from "@/lib/calc/snapshot";
import type { ParagemSnapshot, ParametrosCusto, PneuItem } from "@/lib/calc/types";
import type { Pneu, Utilizador, Veiculo } from "@prisma/client";

type VeiculoComPneus = Veiculo & { pneus: Pneu[] };

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

/** Snapshot a partir das entidades já carregadas (motorista/veículo incluídos). */
export function snapshotDeEntidades(
  { base, pneusGlobais }: BaseSnapshot,
  motorista: Utilizador | null,
  veiculo: VeiculoComPneus | null,
): ParagemSnapshot {
  const pneus = veiculo && veiculo.pneus.length > 0 ? veiculo.pneus.map(toPneuItem) : pneusGlobais;
  return calcularSnapshot(base, motoristaParams(motorista), veiculoParams(veiculo), pneus);
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
          include: { pneus: { orderBy: { ordem: "asc" } } },
        })
      : null,
  ]);
  return snapshotDeEntidades(baseSnap, motorista, veiculo);
}
