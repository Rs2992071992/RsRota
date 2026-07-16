import { derivarCustos } from "./params";
import type { ParagemSnapshot, ParametrosCusto, PneuItem } from "./types";

/** Campos salariais próprios de um motorista (subconjunto de ParametrosCusto). */
export type MotoristaParams = Pick<
  ParametrosCusto,
  | "salarioMensal"
  | "seguroMensal"
  | "percentEncargos"
  | "alimentacaoDia"
  | "diasAlimentacao"
  | "kmAnuais"
  | "fatorAnualizacao"
>;

/** Campos de custo próprios de um veículo (subconjunto de ParametrosCusto). */
export type VeiculoParams = Pick<
  ParametrosCusto,
  | "valorAquisicao"
  | "valorResidual"
  | "vidaUtilAnos"
  | "iucAnual"
  | "taxaJuros"
  | "seguroAnual"
  | "reparacoesAnuais"
  | "revisaoAnual"
  | "inspecaoAnual"
  | "capacidadeCamiao"
  | "capacidadeReboque"
  | "capacidadePaleteA"
  | "capacidadePaleteB"
>;

/**
 * Constrói o snapshot de custos efetivos de uma paragem a partir dos parâmetros
 * globais + (opcionalmente) os parâmetros próprios do motorista e do veículo
 * usados. Quando `motorista`/`veiculo` são null, usam-se os defaults globais
 * (Parametros) — o que reproduz exatamente o cálculo legado (dados importados).
 *
 * Os custos/km derivam de `derivarCustos` sobre o merge {global ⊕ motorista ⊕
 * veículo}: kmAnuais vem do motorista e amortiza também os custos fixos do veículo
 * (modelo de km anual único, igual ao Excel).
 */
export function calcularSnapshot(
  base: ParametrosCusto,
  motorista: MotoristaParams | null,
  veiculo: VeiculoParams | null,
  pneus: PneuItem[],
): ParagemSnapshot {
  const merged: ParametrosCusto = {
    ...base,
    ...(motorista ?? {}),
    ...(veiculo ?? {}),
  };
  const d = derivarCustos(merged, pneus);
  return {
    custoMotoristaPorKm: d.custoMotoristaPorKm,
    custoVeiculoPorKm: d.custoVeiculoPorKm,
    capacidadeCamiao: merged.capacidadeCamiao,
    capacidadeReboque: merged.capacidadeReboque,
    capacidadePaleteA: merged.capacidadePaleteA,
    capacidadePaleteB: merged.capacidadePaleteB,
    precoCombRef: base.precoCombRef,
    consumoAdblue: base.consumoAdblue,
    precoAdblue: base.precoAdblue,
    valorNoite: base.valorNoite,
    valorHoraExtra: base.valorHoraExtra,
    margemMinima: base.margemMinima,
  };
}
