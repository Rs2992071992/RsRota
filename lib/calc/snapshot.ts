import { derivarCustos } from "./params";
import type { EscalaoConsumo, ParagemSnapshot, ParametrosCusto, PneuItem } from "./types";

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
  | "capacidadePaleteACamiao"
  | "capacidadePaleteBCamiao"
>;

/**
 * Caixa de carga (mm) do veículo + do seu reboque habitual, e o fator de
 * ocupação — não fazem parte de `ParametrosCusto` (não há default global,
 * só existem por-veículo), por isso não entram no merge de `calcularSnapshot`
 * como os campos acima; são passados à parte e só copiados para o snapshot.
 */
export interface VeiculoCaixa {
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
  caixaReboqueComprimentoMm: number | null;
  caixaReboqueLarguraMm: number | null;
  fatorOcupacaoPalete: number;
}

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
  caixa: VeiculoCaixa | null = null,
  /**
   * Tabela de consumo própria do veículo usado (já resolvida pelo chamador —
   * ver lib/snapshot-service.ts::snapshotDeEntidades). Vazio (default,
   * incl. chamadas antigas/testes sem este argumento) -> não entra no
   * snapshot, para `efetivos()` cair no fallback do contexto atual em vez de
   * congelar um array vazio.
   */
  tabelaConsumo: EscalaoConsumo[] = [],
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
    capacidadePaleteACamiao: merged.capacidadePaleteACamiao,
    capacidadePaleteBCamiao: merged.capacidadePaleteBCamiao,
    precoCombRef: base.precoCombRef,
    consumoAdblue: base.consumoAdblue,
    precoAdblue: base.precoAdblue,
    valorNoite: base.valorNoite,
    valorHoraExtra: base.valorHoraExtra,
    margemMinima: base.margemMinima,
    caixaComprimentoMm: caixa?.caixaComprimentoMm ?? null,
    caixaLarguraMm: caixa?.caixaLarguraMm ?? null,
    caixaReboqueComprimentoMm: caixa?.caixaReboqueComprimentoMm ?? null,
    caixaReboqueLarguraMm: caixa?.caixaReboqueLarguraMm ?? null,
    fatorOcupacaoPalete: caixa?.fatorOcupacaoPalete ?? 1,
    ...(tabelaConsumo.length > 0 ? { tabelaConsumo } : {}),
  };
}
