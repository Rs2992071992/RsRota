// Tipos e helpers puros partilhados entre o modal de criação de veículo
// (VeiculosManager.tsx) e a página de edição (/escritorio/veiculos/[id]).

import type { Dispatch, SetStateAction } from "react";
import { derivarCustos } from "@/lib/calc/params";
import type { ParametrosCusto, PneuItem } from "@/lib/calc/types";

export type PneuForm = { eixo: string; custo: number; km: number };
export type ConsumoForm = { cargaKg: number; consumoL100: number };

/** Forma mínima de onde se consegue derivar um VeiculoForm (estrutural — aceita
 * o VeiculoBD da lista, o template de defaults, ou o veículo cru vindo do Prisma). */
export interface VeiculoLike {
  nome: string;
  matricula: string | null;
  /** LIGEIRO = só ficha de frota (nome/matrícula/inspeção/manutenção/custo, sem
   * capacidade de carga nem consumo próprio). PESADO = camião, como sempre.
   * Ausente (templates antigos) -> assume-se PESADO. */
  categoria?: "LIGEIRO" | "PESADO";
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
  capacidadePaleteACamiao: number;
  capacidadePaleteBCamiao: number;
  caixaComprimentoMm?: number | null;
  caixaLarguraMm?: number | null;
  reboqueHabitualId?: number | null;
  fatorOcupacaoPalete?: number;
  dataLimiteInspecao?: Date | string | null;
  inspecaoVerificada?: boolean;
  pneus: PneuForm[];
  /** Tabela de consumo própria (L/100km por escalão de carga) — só relevante
   * para PESADO; vazia = usa a tabela global de Parâmetros. */
  consumo?: ConsumoForm[];
}

export interface VeiculoForm {
  nome: string;
  matricula: string;
  categoria: "LIGEIRO" | "PESADO";
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
  capacidadePaleteACamiao: number;
  capacidadePaleteBCamiao: number;
  /** Caixa de carga (mm) — "só camião"; empacotamento de paletes (Cargas) e
   * rateio por dimensão (2026-08-28+). */
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
  /** Reboque habitual (rateio por dimensão, CAMIAO+REBOQUE) + fator de segurança. */
  reboqueHabitualId: number | null;
  fatorOcupacaoPalete: number;
  /** Prazo de inspeção (yyyy-mm-dd) — aviso ao motorista a partir de 45 dias antes. */
  dataLimiteInspecao: string | null;
  inspecaoVerificada: boolean;
  pneus: PneuForm[];
  /** Tabela de consumo própria (L/100km por escalão de carga, só PESADO) —
   * vazia = usa a tabela global de Parâmetros. */
  consumo: ConsumoForm[];
}

// km anuais de referência só para a pré-visualização do custo/km (o valor real do
// cálculo usa os km anuais do motorista que conduz).
export const REF_KM_ANUAIS = 95000;

/** Custos anuais simples — sempre mostrados (Ligeiro e Pesado). */
export const CAMPOS_CUSTO_COMUM: [keyof VeiculoForm, string][] = [
  ["iucAnual", "IUC anual (€)"],
  ["seguroAnual", "Seguro anual (€)"],
  ["reparacoesAnuais", "Reparações anuais (€)"],
  ["revisaoAnual", "Revisão anual (€)"],
  ["inspecaoAnual", "Inspeção anual (€)"],
];

/** Depreciação/amortização — só faz sentido para um camião (valor de aquisição
 * alto, vida útil plurianual); para um ligeiro não se pede esta contabilidade. */
export const CAMPOS_DEPRECIACAO: [keyof VeiculoForm, string][] = [
  ["valorAquisicao", "Valor de aquisição (€)"],
  ["valorResidual", "Valor residual (€)"],
  ["vidaUtilAnos", "Vida útil (anos)"],
  ["taxaJuros", "Taxa de juros (fração)"],
];

/** Capacidade de carga (kg) — só faz sentido para Pesado. */
export const CAMPOS_CAPACIDADE: [keyof VeiculoForm, string][] = [
  ["capacidadeCamiao", "Capacidade camião (kg)"],
  ["capacidadeReboque", "Capacidade camião+reboque (kg)"],
];

/**
 * Capacidade de paletes por CONTAGEM fixa — legado (Paragem.tipoPalete string,
 * anterior a 2026-08-28). As paragens novas usam a capacidade por DIMENSÃO
 * (caixa mm + reboque habitual), por isso estes campos já não se mostram no
 * formulário; continuam em `VeiculoForm`/schema com os valores por defeito só
 * para as paragens antigas recalcularem exatamente como sempre.
 */
const CAMPOS_PALETE_LEGADO: [keyof VeiculoForm, string][] = [
  ["capacidadePaleteA", "Capacidade paletes 120x80, camião+reboque (nº)"],
  ["capacidadePaleteB", "Capacidade paletes 120x100, camião+reboque (nº)"],
  ["capacidadePaleteACamiao", "Capacidade paletes 120x80, só camião (nº)"],
  ["capacidadePaleteBCamiao", "Capacidade paletes 120x100, só camião (nº)"],
];

export function veiculoParaForm(v: VeiculoLike): VeiculoForm {
  return {
    nome: v.nome,
    matricula: v.matricula ?? "",
    categoria: v.categoria ?? "PESADO",
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
    caixaComprimentoMm: v.caixaComprimentoMm ?? null,
    caixaLarguraMm: v.caixaLarguraMm ?? null,
    reboqueHabitualId: v.reboqueHabitualId ?? null,
    fatorOcupacaoPalete: v.fatorOcupacaoPalete ?? 1,
    dataLimiteInspecao: v.dataLimiteInspecao
      ? new Date(v.dataLimiteInspecao).toISOString().slice(0, 10)
      : null,
    inspecaoVerificada: v.inspecaoVerificada ?? false,
    pneus: v.pneus.map((p) => ({ ...p })),
    consumo: (v.consumo ?? []).map((c) => ({ ...c })),
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
    capacidadePaleteACamiao: f.capacidadePaleteACamiao, capacidadePaleteBCamiao: f.capacidadePaleteBCamiao,
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

export function updConsumo(
  setF: Dispatch<SetStateAction<VeiculoForm>>,
  i: number,
  campo: keyof ConsumoForm,
  valor: number,
) {
  setF((pr) => ({
    ...pr,
    consumo: pr.consumo.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)),
  }));
}

/** Label legível por campo do formulário — usado para traduzir os erros do Zod
 * (ver `formatarErrosVeiculo`) em vez de mostrar só "Dados inválidos.". */
const LABELS_CAMPO: Record<string, string> = Object.fromEntries([
  ["nome", "Nome"],
  ["matricula", "Matrícula"],
  ["dataLimiteInspecao", "Data limite de inspeção"],
  ...CAMPOS_CUSTO_COMUM,
  ...CAMPOS_DEPRECIACAO,
  ...CAMPOS_CAPACIDADE,
  ...CAMPOS_PALETE_LEGADO,
]);

/**
 * Traduz `parsed.error.flatten()` (zod, devolvido pela API em `detalhes`) numa
 * frase legível ("Vida útil (anos): Deve ser > 0"). Sem isto, um único campo
 * inválido rejeita o payload inteiro e a única mensagem visível era "Dados
 * inválidos." — sem dizer qual campo, o que já causou confusão (ver
 * tasks/lessons.md, 2026-09-05).
 */
export function formatarErrosVeiculo(
  detalhes: { fieldErrors?: Record<string, string[] | undefined> } | undefined,
): string | null {
  const fieldErrors = detalhes?.fieldErrors;
  if (!fieldErrors) return null;
  const partes = Object.entries(fieldErrors)
    .filter((e): e is [string, string[]] => !!e[1] && e[1].length > 0)
    .map(([campo, msgs]) => `${LABELS_CAMPO[campo] ?? campo}: ${msgs[0]}`);
  return partes.length > 0 ? partes.join(" · ") : null;
}
