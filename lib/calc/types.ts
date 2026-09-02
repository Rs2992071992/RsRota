// Tipos do motor de cálculo. Puro TypeScript, sem dependências de framework/DB.

export type TipoViagem = "Ida" | "Volta";
export type TipoVeiculo = "CAMIAO" | "CAMIAO+REBOQUE" | "VAZIO";
export type TipoPalete = "PALETE_120X80" | "PALETE_120X100";

/** Parâmetros de custo editáveis (§3.4), em forma plana. */
export interface ParametrosCusto {
  // Motorista
  salarioMensal: number;
  seguroMensal: number;
  percentEncargos: number; // ex.: 0.235
  alimentacaoDia: number;
  diasAlimentacao: number;
  kmAnuais: number;
  fatorAnualizacao: number; // ex.: 14 (salários/ano em PT)
  // Veículo
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  iucAnual: number;
  taxaJuros: number; // ex.: 0.02
  seguroAnual: number;
  reparacoesAnuais: number;
  revisaoAnual: number;
  inspecaoAnual: number;
  // Combustível / AdBlue
  precoCombRef: number;
  precoCombReal: number;
  consumoAdblue: number; // L/100km
  precoAdblue: number; // €/L
  // Outros
  margemMinima: number; // ex.: 1.25
  valorHoraExtra: number;
  valorNoite: number; // € por noite fora
  capacidadeCamiao: number;
  capacidadeReboque: number;
  // Paletes (Paragem.volume=true): ocupação por nº de paletes, não por peso —
  // o peso não entra no registo nem no cálculo (consumo tratado sempre como
  // vazio, ver calcularParagem). Par "A/B" para tipoVeiculo=CAMIAO+REBOQUE,
  // par "ACamiao/BCamiao" para tipoVeiculo=CAMIAO (mesma distinção que já
  // existe para peso em capacidadeCamiao/capacidadeReboque).
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  capacidadePaleteACamiao: number;
  capacidadePaleteBCamiao: number;
}

export interface PneuItem {
  custo: number;
  km: number;
}

/** Linha da tabela de consumo por carga. */
export interface EscalaoConsumo {
  cargaKg: number;
  consumoL100: number;
}

/** Linha da tabela de portagens. */
export interface PortagemItem {
  zona: string;
  valor: number;
}

/** Custos derivados por km (mostrados no painel para validação). */
export interface CustosDerivados {
  custoMotoristaPorKm: number;
  custoVeiculoPorKm: number;
  detalhe: {
    custoMensalMotorista: number;
    depreciacaoAnual: number;
    jurosAnuais: number;
    custosFixosAnuais: number;
    custoFixoAnualKm: number;
    reparacoesKm: number;
    revisaoKm: number;
    inspecaoKm: number;
    pneusKm: number;
    manutencaoKm: number;
  };
}

/**
 * Snapshot dos custos efetivos de uma paragem, congelados no registo (histórico
 * estável). Contém os dois custos/km derivados (do motorista e do veículo usados)
 * e os escalares globais aplicáveis. É guardado em `Paragem.snapshot` (Json) e
 * usado pelo motor em vez dos parâmetros atuais quando presente.
 */
export interface ParagemSnapshot {
  custoMotoristaPorKm: number;
  custoVeiculoPorKm: number;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  /** ⚠️ Legado (paragens com Paragem.tipoPalete string, anteriores a 2026-08-28). */
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  capacidadePaleteACamiao: number;
  capacidadePaleteBCamiao: number;
  precoCombRef: number;
  consumoAdblue: number;
  precoAdblue: number;
  valorNoite: number;
  valorHoraExtra: number;
  margemMinima: number;
  /**
   * Caixa de carga do veículo (mm, "só camião") e do seu reboque habitual, se
   * ligado — congeladas no registo para o rateio por dimensão (2026-08-28 em
   * diante, ver lib/calc/perStop.ts::capacidadePaleteDimensoes). null quando o
   * veículo não tem `caixaComprimentoMm/LarguraMm` configurados, ou não tem
   * reboque habitual ligado (caixaReboque*).
   */
  caixaComprimentoMm?: number | null;
  caixaLarguraMm?: number | null;
  caixaReboqueComprimentoMm?: number | null;
  caixaReboqueLarguraMm?: number | null;
  /** Multiplicador de segurança do veículo sobre a capacidade geométrica. Default 1. */
  fatorOcupacaoPalete?: number;
}

/**
 * Uma linha de palete de uma paragem (ver `ParagemInput.paletes`). As dimensões
 * são a cópia congelada no momento do registo — fonte de verdade do cálculo,
 * imune a edições posteriores do catálogo `TipoPalete`. `tipoPaleteId` é só
 * referência/label.
 */
export interface PaleteLinha {
  tipoPaleteId: number | null;
  comprimentoMm: number;
  larguraMm: number;
  nPaletes: number;
}

/** Dados de uma paragem necessários ao cálculo. */
export interface ParagemInput {
  id?: number;
  /** Custos efetivos congelados; quando ausente, usa-se o contexto atual (fallback). */
  snapshot?: ParagemSnapshot;
  idRota: string;
  data?: Date | string | null;
  cliente: string;
  tipoViagem: TipoViagem | string;
  tipoVeiculo: TipoVeiculo | string;
  kmInicial: number;
  kmFinal: number;
  kgCarregados: number;
  kgDescarregados: number;
  /**
   * Peso realmente a bordo durante ESTE troço, calculado ao nível da rota
   * (agrupando paragens da mesma rota/direção/dia — ver
   * `pesosEmTransito` em lib/calc/perRoute.ts) em vez do peso próprio desta
   * paragem isolada. Numa rota com vários clientes o camião vai mais pesado
   * nos primeiros troços (ainda leva a carga dos clientes seguintes) e mais
   * leve nos últimos. Se ausente, o consumo usa o peso próprio da paragem
   * (comportamento inalterado — é sempre o caso para orçamentos, que nunca
   * agrupam paragens).
   */
  pesoEmTransito?: number;
  /** ⚠️ Legado — ver tipoPalete abaixo. Paragens novas usam paleteComprimentoMm/LarguraMm. */
  volume?: boolean;
  /** ⚠️ Legado (PALETE_120X80|PALETE_120X100), só relevante se volume=true. */
  tipoPalete?: string | null;
  /** Nº de paletes (paragens novas E legado — ver paleteComprimentoMm/tipoPalete). */
  nPaletes?: number;
  /**
   * Nº de meias-paletes empilhadas em cima das paletes de base (`nPaletes`)
   * — sem dimensões próprias, nunca entram no cálculo de capacidade/espaço
   * (não ocupam uma base própria), só valem metade de uma palete inteira no
   * numerador do coeficiente de carga.
   */
  nMeiasPaletes?: number;
  /** Referência ao catálogo TipoPalete (label/relatórios) — nunca fonte de verdade. */
  tipoPaleteId?: number | null;
  /**
   * Dimensões da palete escolhida, congeladas no momento do registo (fonte de
   * verdade do cálculo). Presentes -> `paleteEfetiva()` usa o caminho novo
   * (ocupação por área); ausentes -> cai no caminho legado (`tipoPalete`/`volume`).
   */
  paleteComprimentoMm?: number | null;
  paleteLarguraMm?: number | null;
  /**
   * Várias linhas de palete na MESMA paragem (2026-09+) — tamanhos diferentes
   * para o mesmo cliente/descarga. Quando presente e não-vazio, é a fonte de
   * verdade: `coeficienteCarga` = Σ (nPaletesᵢ / capacidade(dimᵢ)), e os campos
   * escalares acima (`nPaletes`/`paleteComprimentoMm`/…) ficam só como agregado
   * para leitores antigos. Ausente/vazio -> caminho de linha única (escalares).
   */
  paletes?: PaleteLinha[] | null;
  /** Peso aproximado (kg), só para a tabela de consumos — nunca entra no rateio. */
  pesoAproximado?: number | null;
  zonaPortagem: string;
  portagensExtra: number;
  noitesFora: number;
  alimentacao: number;
  horasExtra: number;
  precoCombRefOverride?: number | null;
  receitaPaga: number;
  /**
   * Recolha para entregar a outro cliente: `recolha` é o assinalar do
   * motorista (informativo, não afeta o rateio); `faturarCliente`, quando
   * preenchido, atribui o coeficiente desta paragem a esse nome em vez do
   * próprio `cliente`. null/ausente = fatura normalmente ao próprio
   * cliente (comportamento inalterado).
   */
  recolha?: boolean;
  faturarCliente?: string | null;
  /**
   * Atribuição manual do custo deste troço a clientes — só relevante quando
   * `tipoVeiculo = VAZIO`. Cada `km` converte-se em fração do troço
   * (`km/kmFeitos`) aplicada ao custo desse troço, entregue diretamente ao
   * `cliente` indicado (fora do rateio proporcional normal). O que não for
   * coberto pelos km indicados continua a diluir-se automaticamente pelos
   * clientes da rota, como sempre — ver `lib/calc/perRoute.ts::calcularRota`.
   * null/ausente = sem override (comportamento inalterado).
   */
  rateioManual?: RateioManualItem[] | null;
  // Informativo (Espanha)
  litrosEspanha?: number | null;
  custoEspanha?: number | null;
}

/** Resultado do cálculo de uma paragem. */
export interface ParagemCalc {
  id?: number;
  idRota: string;
  cliente: string;
  tipoVeiculo: string;
  /** Passthrough — ver ParagemInput.recolha / .faturarCliente / .rateioManual. */
  recolha: boolean;
  faturarCliente: string | null;
  rateioManual: RateioManualItem[] | null;
  pesoTransportado: number;
  /** Passthrough — ver ParagemInput.volume / .tipoPalete. */
  volume: boolean;
  tipoPalete: string | null;
  /** Nº de paletes (passthrough; legado quando volume=true, ou paragens novas). */
  nPaletes: number;
  /** Passthrough — ver ParagemInput.nMeiasPaletes. */
  nMeiasPaletes: number;
  /** Passthrough — ver ParagemInput.tipoPaleteId/paleteComprimentoMm/paleteLarguraMm. */
  tipoPaleteId: number | null;
  paleteComprimentoMm: number | null;
  paleteLarguraMm: number | null;
  /** Passthrough — ver ParagemInput.paletes. null = paragem de linha única. */
  paletes: PaleteLinha[] | null;
  /** Passthrough — ver ParagemInput.pesoAproximado. */
  pesoAproximado: number | null;
  kmFeitos: number;
  /** Coeficiente de carga: peso/capacidade (kg) ou nº paletes/capacidade. */
  coeficienteCarga: number;
  consumoL100: number;
  litrosGastos: number;
  precoCombUsado: number;
  custoCombustivel: number;
  adblueLitros: number;
  custoAdblue: number;
  custoMotorista: number;
  custoVeiculo: number;
  portagensExtra: number;
  /** Portagem da tabela (lookup pela zona) — entra no custo da rota, não no da paragem. */
  portagemTabela: number;
  /** Custo da paragem (§4.1) = portagensExtra + comb + motorista + veículo + adblue. */
  custoParagem: number;
  precoPorKg: number;
  // Espanha (informativo)
  litrosEspanha: number;
  poupancaEspanha: number;
}

/** Um item de atribuição manual — ver `ParagemInput.rateioManual`. */
export interface RateioManualItem {
  cliente: string;
  km: number;
}

/** Repartição do custo da rota por cliente. */
export interface RateioCliente {
  cliente: string;
  /** Coeficiente bruto somado (peso/capacidade); > 1 indica sobrecarga. Indicador, não soma 100 %. */
  coefReal: number;
  /** Quota normalizada (0–1): fração do custo da rota atribuída ao cliente. As quotas somam 1. */
  quota: number;
  custoAtribuido: number;
  receitaPaga: number;
}

/** Resultado do cálculo de uma rota. */
export interface RotaCalc {
  idRota: string;
  /** Data da 1ª paragem (início) e da última (fim) da rota. */
  dataInicio: Date;
  dataFim: Date;
  paragens: ParagemCalc[];
  // Componentes do custo total
  somaCustoParagens: number;
  somaNoites: number;
  somaAlimentacao: number;
  somaHorasExtraValor: number;
  somaPortagensTabela: number;
  custoTotalRota: number;
  // Rentabilidade
  precoMinimo: number;
  receitaTotal: number;
  lucro: number;
  alerta: "🔴 PREJUÍZO" | "🟢 OK";
  // Rateio por cliente (auditável)
  rateio: RateioCliente[];
  // Métricas úteis
  kmTotais: number;
  totalKgCarregados: number;
  totalKgDescarregados: number;
  /** Soma de nPaletes só das paragens de volume (Paragem.volume=true). */
  totalPaletes: number;
}
