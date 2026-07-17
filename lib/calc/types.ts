// Tipos do motor de cálculo. Puro TypeScript, sem dependências de framework/DB.

export type TipoViagem = "Ida" | "Volta";
export type TipoVeiculo = "CAMIAO" | "CAMIAO+REBOQUE" | "LEVE" | "VAZIO";

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
  // Paletes (tipoVeiculo = PALETE_120X80 | PALETE_120X100): ocupação por nº
  // de paletes, não por peso — o peso não entra no registo nem no cálculo
  // (consumo tratado sempre como vazio, ver calcularParagem).
  capacidadePaleteA: number;
  capacidadePaleteB: number;
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
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  precoCombRef: number;
  consumoAdblue: number;
  precoAdblue: number;
  valorNoite: number;
  valorHoraExtra: number;
  margemMinima: number;
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
  /** Nº de paletes (só relevante para tipoVeiculo PALETE_120X80|PALETE_120X100). */
  nPaletes?: number;
  zonaPortagem: string;
  portagensExtra: number;
  noitesFora: number;
  alimentacao: number;
  horasExtra: number;
  precoCombRefOverride?: number | null;
  receitaPaga: number;
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
  pesoTransportado: number;
  /** Nº de paletes (passthrough; só relevante para tipos de palete). */
  nPaletes: number;
  kmFeitos: number;
  /** Coeficiente de carga: número ou "Volume" (LEVE). */
  coeficienteCarga: number | "Volume";
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
}
