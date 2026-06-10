import { consumoPorCarga, valorPortagem } from "./lookups";
import type {
  CustosDerivados,
  EscalaoConsumo,
  ParagemCalc,
  ParagemInput,
  ParametrosCusto,
  PortagemItem,
} from "./types";

export interface ContextoCalculo {
  params: ParametrosCusto;
  derivados: CustosDerivados;
  tabelaConsumo: EscalaoConsumo[];
  tabelaPortagens: PortagemItem[];
}

/**
 * Peso transportado de uma paragem. O registo do motorista tem KG Carregados e
 * KG Descarregados; o peso que esteve a bordo nessa etapa é o maior dos dois.
 */
export function pesoTransportado(p: ParagemInput): number {
  return Math.max(p.kgCarregados || 0, p.kgDescarregados || 0);
}

/** Capacidade do veículo conforme o tipo. */
function capacidade(tipoVeiculo: string, params: ParametrosCusto): number {
  return tipoVeiculo === "CAMIAO+REBOQUE"
    ? params.capacidadeReboque
    : params.capacidadeCamiao;
}

/**
 * Calcula todos os valores de uma paragem (§4.1). Funções puras, sem efeitos.
 * Trata peso 0 e dados em falta de forma graciosa (sem divisão por zero).
 */
export function calcularParagem(p: ParagemInput, ctx: ContextoCalculo): ParagemCalc {
  const { params, derivados, tabelaConsumo, tabelaPortagens } = ctx;

  const kmFeitos = (p.kmFinal || 0) - (p.kmInicial || 0);
  const peso = pesoTransportado(p);

  // Coeficiente de carga: "Volume" para LEVE; senão peso / capacidade.
  const coeficienteCarga: number | "Volume" =
    p.tipoVeiculo === "LEVE" ? "Volume" : peso / capacidade(p.tipoVeiculo, params);

  // Consumo (lookup aproximado) e combustível.
  const consumoL100 = consumoPorCarga(peso, tabelaConsumo);
  const litrosGastos = (consumoL100 / 100) * kmFeitos;
  const precoCombUsado =
    p.precoCombRefOverride != null ? p.precoCombRefOverride : params.precoCombRef;
  const custoCombustivel = litrosGastos * precoCombUsado;

  // AdBlue.
  const adblueLitros = (kmFeitos * params.consumoAdblue) / 100;
  const custoAdblue = adblueLitros * params.precoAdblue;

  // Motorista e veículo (custo/km × km feitos).
  const custoMotorista = derivados.custoMotoristaPorKm * kmFeitos;
  const custoVeiculo = derivados.custoVeiculoPorKm * kmFeitos;

  // Portagem da tabela (entra no custo da ROTA, não no da paragem).
  const portagemTabela = valorPortagem(p.zonaPortagem, tabelaPortagens).valor;

  // Custo da paragem (§4.1) = portagens extra + comb + motorista + veículo + adblue.
  const custoParagem =
    (p.portagensExtra || 0) +
    custoCombustivel +
    custoMotorista +
    custoVeiculo +
    custoAdblue;

  // Preço por kg (evita divisão por zero).
  const precoPorKg = peso > 0 ? custoParagem / peso : 0;

  // Espanha (informativo): poupança vs preço de referência.
  const litrosEspanha = p.litrosEspanha || 0;
  const custoEspanha = p.custoEspanha || 0;
  const poupancaEspanha =
    litrosEspanha > 0 ? litrosEspanha * params.precoCombRef - custoEspanha : 0;

  return {
    id: p.id,
    idRota: p.idRota,
    cliente: p.cliente,
    tipoVeiculo: p.tipoVeiculo,
    pesoTransportado: peso,
    kmFeitos,
    coeficienteCarga,
    consumoL100,
    litrosGastos,
    precoCombUsado,
    custoCombustivel,
    adblueLitros,
    custoAdblue,
    custoMotorista,
    custoVeiculo,
    portagensExtra: p.portagensExtra || 0,
    portagemTabela,
    custoParagem,
    precoPorKg,
    litrosEspanha,
    poupancaEspanha,
  };
}

/**
 * Coeficiente real de rateio (§4.2 — lógica corrigida):
 * - peso 0, VAZIO ou LEVE -> 1
 * - CAMIAO -> peso / capacidade camião
 * - CAMIAO+REBOQUE -> peso / capacidade reboque
 *
 * O coeficiente NÃO está limitado a 1: cargas acima da capacidade (sobrecarga)
 * dão coeficiente > 1, refletindo que a carga "pesa" mais do que um camião cheio.
 */
export function coeficienteReal(
  tipoVeiculo: string,
  peso: number,
  params: ParametrosCusto,
): number {
  if (peso <= 0 || tipoVeiculo === "VAZIO" || tipoVeiculo === "LEVE") {
    return 1;
  }
  if (tipoVeiculo === "CAMIAO") {
    return peso / params.capacidadeCamiao;
  }
  if (tipoVeiculo === "CAMIAO+REBOQUE") {
    return peso / params.capacidadeReboque;
  }
  return 1;
}
