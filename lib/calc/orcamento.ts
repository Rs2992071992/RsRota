// Motor de orçamento (devis). Puro: sem DB nem rede. Reutiliza o motor de paragem
// (`calcularParagem`) para estimar o custo de um transporte ANTES de o realizar,
// a partir de km + peso + zona + tipo de veículo, e deriva o preço sugerido com a
// margem mínima do snapshot. NÃO mexe no cálculo de rotas/rentabilidade existente.

import { calcularParagem, type ContextoCalculo } from "./perStop";
import type { ParagemSnapshot } from "./types";

/** Uma linha de orçamento, tal como é guardada em `Devis.linhas` (Json). */
export interface LinhaDevis {
  descricao: string;
  origem: string;
  destino: string;
  /** Distância (km, só ida) devolvida pela API de mapas; null se foi manual. */
  kmAuto: number | null;
  /** true => conta o regresso (camião volta a vazio) → km = kmAuto × 2. */
  idaVolta: boolean;
  /** Km FINAL retido para o cálculo (editável pelo escritório). */
  km: number;
  pesoKg: number;
  tipoVeiculo: string;
  zonaPortagem: string | null;
  /** Custo estimado pelo motor (comb + adblue + motorista + veículo + portagens). */
  custoEstimado: number;
  /** Preço faturado ao cliente (sugerido = custo × margem; editável). */
  preco: number;
}

/** Entrada mínima para estimar o custo de uma linha. */
export interface EstimarLinhaInput {
  km: number;
  pesoKg: number;
  tipoVeiculo: string;
  zonaPortagem?: string | null;
  /** Portagens extra fixas (opcional; somam-se ao custo). */
  portagensExtra?: number;
}

/** Decomposição do custo (uso INTERNO no escritório; nunca aparece no PDF do cliente). */
export interface DetalheEstimativa {
  km: number;
  pesoKg: number;
  consumoL100: number;
  litrosGastos: number;
  precoCombUsado: number;
  custoCombustivel: number;
  adblueLitros: number;
  custoAdblue: number;
  custoMotorista: number;
  custoMotoristaPorKm: number;
  custoVeiculo: number;
  custoVeiculoPorKm: number;
  /** Portagem efetivamente usada (override automático TollGuru, senão tabela por zona). */
  portagem: number;
  /** true se a portagem veio do cálculo automático (TollGuru); false se da tabela. */
  portagemAuto: boolean;
  portagensExtra: number;
  margemMinima: number;
}

export interface EstimativaLinha {
  custoEstimado: number;
  precoSugerido: number;
  detalhe: DetalheEstimativa;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Aplica o regresso a vazio: km total = km de ida × (idaVolta ? 2 : 1), arredondado. */
export function kmComRegresso(kmIda: number, idaVolta: boolean): number {
  return Math.round((kmIda || 0) * (idaVolta ? 2 : 1));
}

/**
 * Estima o custo de uma linha de orçamento e o preço sugerido. Usa `calcularParagem`
 * (mesmo motor das paragens reais) com o snapshot fornecido, e SOMA a portagem da
 * tabela (que num orçamento é um custo real a faturar), ao contrário do custo de
 * paragem isolado. Preço sugerido = custo × margemMinima do snapshot.
 *
 * `portagemOverride` (ex.: do TollGuru) substitui a portagem da tabela por zona,
 * evitando dupla contagem. Quando null/undefined usa-se a tabela (comportamento atual).
 */
export function estimarLinha(
  input: EstimarLinhaInput,
  ctx: ContextoCalculo,
  snapshot: ParagemSnapshot,
  portagemOverride?: number | null,
): EstimativaLinha {
  const calc = calcularParagem(
    {
      snapshot,
      idRota: "",
      cliente: "",
      tipoViagem: "Ida",
      tipoVeiculo: input.tipoVeiculo,
      kmInicial: 0,
      kmFinal: input.km || 0,
      kgCarregados: input.pesoKg || 0,
      kgDescarregados: 0,
      zonaPortagem: input.zonaPortagem || "",
      portagensExtra: input.portagensExtra || 0,
      noitesFora: 0,
      alimentacao: 0,
      horasExtra: 0,
      receitaPaga: 0,
    },
    ctx,
  );

  const portagemAuto = portagemOverride != null;
  const portagem = portagemAuto ? portagemOverride : calc.portagemTabela;

  const custoEstimado = round2(calc.custoParagem + portagem);
  const precoSugerido = round2(custoEstimado * snapshot.margemMinima);
  return {
    custoEstimado,
    precoSugerido,
    detalhe: {
      km: calc.kmFeitos,
      pesoKg: calc.pesoTransportado,
      consumoL100: calc.consumoL100,
      litrosGastos: round2(calc.litrosGastos),
      precoCombUsado: calc.precoCombUsado,
      custoCombustivel: round2(calc.custoCombustivel),
      adblueLitros: round2(calc.adblueLitros),
      custoAdblue: round2(calc.custoAdblue),
      custoMotorista: round2(calc.custoMotorista),
      custoMotoristaPorKm: snapshot.custoMotoristaPorKm,
      custoVeiculo: round2(calc.custoVeiculo),
      custoVeiculoPorKm: snapshot.custoVeiculoPorKm,
      portagem: round2(portagem),
      portagemAuto,
      portagensExtra: round2(calc.portagensExtra),
      margemMinima: snapshot.margemMinima,
    },
  };
}

export interface TotaisDevis {
  subtotal: number;
  ivaValor: number;
  total: number;
}

/** Totais de um orçamento a partir das linhas e da taxa de IVA (%). Puro. */
export function totaisDevis(
  linhas: Pick<LinhaDevis, "preco">[],
  ivaPercent: number,
): TotaisDevis {
  const subtotal = round2(linhas.reduce((acc, l) => acc + (l.preco || 0), 0));
  const ivaValor = round2((subtotal * (ivaPercent || 0)) / 100);
  const total = round2(subtotal + ivaValor);
  return { subtotal, ivaValor, total };
}

/**
 * Próximo número de orçamento do ano (`ORC-AAAA-NNNN`), dado o conjunto dos números
 * já existentes. Puro (a leitura da BD fica na rota API). Preenche o primeiro inteiro
 * livre acima do máximo do ano.
 */
export function proximoNumeroDevis(ano: number, existentes: string[]): string {
  const prefixo = `ORC-${ano}-`;
  let maxN = 0;
  for (const n of existentes) {
    if (!n.startsWith(prefixo)) continue;
    const m = /-(\d+)$/.exec(n);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `${prefixo}${String(maxN + 1).padStart(4, "0")}`;
}
