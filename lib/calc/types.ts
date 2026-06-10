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

/** Dados de uma paragem necessários ao cálculo. */
export interface ParagemInput {
  id?: number;
  idRota: string;
  data?: Date | string | null;
  cliente: string;
  tipoViagem: TipoViagem | string;
  tipoVeiculo: TipoVeiculo | string;
  kmInicial: number;
  kmFinal: number;
  kgCarregados: number;
  kgDescarregados: number;
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
  coefReal: number;
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
