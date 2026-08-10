// Tipos e helpers puros partilhados entre o modal de criação de veículo
// (VeiculosManager.tsx) e a página de edição (/escritorio/veiculos/[id]).

import type { Dispatch, SetStateAction } from "react";
import { derivarCustos } from "@/lib/calc/params";
import type { ParametrosCusto, PneuItem } from "@/lib/calc/types";

export type PneuForm = { eixo: string; custo: number; km: number };

/** Forma mínima de onde se consegue derivar um VeiculoForm (estrutural — aceita
 * o VeiculoBD da lista, o template de defaults, ou o veículo cru vindo do Prisma). */
export interface VeiculoLike {
  nome: string;
  matricula: string | null;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  iucAnual: number;
  taxaJuros: number;
  seguroAnual: number;
  reparacoesAnuais: number;
  revisaoAnual: number;
  inspecaoAnual: number;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  caixaComprimentoMm?: number | null;
  caixaLarguraMm?: number | null;
  dataLimiteInspecao?: Date | string | null;
  inspecaoVerificada?: boolean;
  pneus: PneuForm[];
}

export interface VeiculoForm {
  nome: string;
  matricula: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  iucAnual: number;
  taxaJuros: number;
  seguroAnual: number;
  reparacoesAnuais: number;
  revisaoAnual: number;
  inspecaoAnual: number;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  /** Caixa de carga (mm) — opcional, só usado no empacotamento de paletes (Cargas). */
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
  /** Prazo de inspeção (yyyy-mm-dd) — aviso ao motorista a partir de 45 dias antes. */
  dataLimiteInspecao: string | null;
  inspecaoVerificada: boolean;
  pneus: PneuForm[];
}

// km anuais de referência só para a pré-visualização do custo/km (o valor real do
// cálculo usa os km anuais do motorista que conduz).
export const REF_KM_ANUAIS = 95000;

export const CAMPOS_CUSTO: [keyof VeiculoForm, string][] = [
  ["valorAquisicao", "Valor de aquisição (€)"],
  ["valorResidual", "Valor residual (€)"],
  ["vidaUtilAnos", "Vida útil (anos)"],
  ["iucAnual", "IUC anual (€)"],
  ["taxaJuros", "Taxa de juros (fração)"],
  ["seguroAnual", "Seguro anual (€)"],
  ["reparacoesAnuais", "Reparações anuais (€)"],
  ["revisaoAnual", "Revisão anual (€)"],
  ["inspecaoAnual", "Inspeção anual (€)"],
  ["capacidadeCamiao", "Capacidade camião (kg)"],
  ["capacidadeReboque", "Capacidade camião+reboque (kg)"],
  ["capacidadePaleteA", "Capacidade paletes 120x80 (nº)"],
  ["capacidadePaleteB", "Capacidade paletes 120x100 (nº)"],
];

export function veiculoParaForm(v: VeiculoLike): VeiculoForm {
  return {
    nome: v.nome,
    matricula: v.matricula ?? "",
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
    caixaComprimentoMm: v.caixaComprimentoMm ?? null,
    caixaLarguraMm: v.caixaLarguraMm ?? null,
    dataLimiteInspecao: v.dataLimiteInspecao
      ? new Date(v.dataLimiteInspecao).toISOString().slice(0, 10)
      : null,
    inspecaoVerificada: v.inspecaoVerificada ?? false,
    pneus: v.pneus.map((p) => ({ ...p })),
  };
}

/** Custo veículo/km (pré-visualização, km anuais de referência). */
export function custoVeiculoKm(f: VeiculoForm): number {
  const fake: ParametrosCusto = {
    salarioMensal: 0, seguroMensal: 0, percentEncargos: 0, alimentacaoDia: 0,
    diasAlimentacao: 0, kmAnuais: REF_KM_ANUAIS, fatorAnualizacao: 0,
    valorAquisicao: f.valorAquisicao, valorResidual: f.valorResidual,
    vidaUtilAnos: f.vidaUtilAnos, iucAnual: f.iucAnual, taxaJuros: f.taxaJuros,
    seguroAnual: f.seguroAnual, reparacoesAnuais: f.reparacoesAnuais,
    revisaoAnual: f.revisaoAnual, inspecaoAnual: f.inspecaoAnual,
    precoCombRef: 0, precoCombReal: 0, consumoAdblue: 0, precoAdblue: 0,
    margemMinima: 0, valorHoraExtra: 0, valorNoite: 0,
    capacidadeCamiao: f.capacidadeCamiao, capacidadeReboque: f.capacidadeReboque,
    capacidadePaleteA: f.capacidadePaleteA, capacidadePaleteB: f.capacidadePaleteB,
  };
  return derivarCustos(fake, f.pneus as PneuItem[]).custoVeiculoPorKm;
}

export function updPneu(
  setF: Dispatch<SetStateAction<VeiculoForm>>,
  i: number,
  campo: keyof PneuForm,
  valor: string | number,
) {
  setF((pr) => ({
    ...pr,
    pneus: pr.pneus.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)),
  }));
}
