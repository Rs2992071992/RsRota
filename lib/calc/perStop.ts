import { consumoPorCarga, valorPortagem } from "./lookups";
import type {
  CustosDerivados,
  EscalaoConsumo,
  ParagemCalc,
  ParagemInput,
  ParagemSnapshot,
  ParametrosCusto,
  PortagemItem,
} from "./types";

export interface ContextoCalculo {
  params: ParametrosCusto;
  derivados: CustosDerivados;
  tabelaConsumo: EscalaoConsumo[];
  tabelaPortagens: PortagemItem[];
}

/** Apenas os campos de capacidade — aceita um snapshot ou os parâmetros globais. */
type ComCapacidades = Pick<
  ParagemSnapshot,
  "capacidadeCamiao" | "capacidadeReboque" | "capacidadePaleteA" | "capacidadePaleteB"
>;

/**
 * Custos efetivos de uma paragem: usa o snapshot congelado quando existe, senão
 * cai no contexto atual (parâmetros globais). Centraliza a regra "por-motorista/
 * por-veículo + histórico estável" para o resto do motor.
 */
export function efetivos(p: ParagemInput, ctx: ContextoCalculo): ParagemSnapshot {
  if (p.snapshot) return p.snapshot;
  return {
    custoMotoristaPorKm: ctx.derivados.custoMotoristaPorKm,
    custoVeiculoPorKm: ctx.derivados.custoVeiculoPorKm,
    capacidadeCamiao: ctx.params.capacidadeCamiao,
    capacidadeReboque: ctx.params.capacidadeReboque,
    capacidadePaleteA: ctx.params.capacidadePaleteA,
    capacidadePaleteB: ctx.params.capacidadePaleteB,
    precoCombRef: ctx.params.precoCombRef,
    consumoAdblue: ctx.params.consumoAdblue,
    precoAdblue: ctx.params.precoAdblue,
    valorNoite: ctx.params.valorNoite,
    valorHoraExtra: ctx.params.valorHoraExtra,
    margemMinima: ctx.params.margemMinima,
  };
}

/**
 * Peso transportado de uma paragem. O registo do motorista tem KG Carregados e
 * KG Descarregados; o peso que esteve a bordo nessa etapa é o maior dos dois.
 */
export function pesoTransportado(p: ParagemInput): number {
  return Math.max(p.kgCarregados || 0, p.kgDescarregados || 0);
}

/** Capacidade do veículo conforme o tipo. */
function capacidade(tipoVeiculo: string, cap: ComCapacidades): number {
  return tipoVeiculo === "CAMIAO+REBOQUE"
    ? cap.capacidadeReboque
    : cap.capacidadeCamiao;
}

/**
 * Calcula todos os valores de uma paragem (§4.1). Funções puras, sem efeitos.
 * Trata peso 0 e dados em falta de forma graciosa (sem divisão por zero).
 */
export function calcularParagem(p: ParagemInput, ctx: ContextoCalculo): ParagemCalc {
  const { tabelaConsumo, tabelaPortagens } = ctx;
  const eff = efetivos(p, ctx);

  const kmFeitos = (p.kmFinal || 0) - (p.kmInicial || 0);
  const peso = pesoTransportado(p);
  const nPaletes = p.nPaletes || 0;

  // Coeficiente de carga: "Volume" para LEVE; paletes -> nº paletes/capacidade
  // desse tipo (uma palete leve ocupa o mesmo "slot" físico, o peso não
  // reflete a ocupação real); senão peso / capacidade (kg).
  const coeficienteCarga: number | "Volume" =
    p.tipoVeiculo === "LEVE"
      ? "Volume"
      : p.tipoVeiculo === "PALETE_120X80"
        ? nPaletes / eff.capacidadePaleteA
        : p.tipoVeiculo === "PALETE_120X100"
          ? nPaletes / eff.capacidadePaleteB
          : peso / capacidade(p.tipoVeiculo, eff);

  // Consumo (lookup aproximado) e combustível.
  const consumoL100 = consumoPorCarga(peso, tabelaConsumo);
  const litrosGastos = (consumoL100 / 100) * kmFeitos;
  const precoCombUsado =
    p.precoCombRefOverride != null ? p.precoCombRefOverride : eff.precoCombRef;
  const custoCombustivel = litrosGastos * precoCombUsado;

  // AdBlue.
  const adblueLitros = (kmFeitos * eff.consumoAdblue) / 100;
  const custoAdblue = adblueLitros * eff.precoAdblue;

  // Motorista e veículo (custo/km × km feitos).
  const custoMotorista = eff.custoMotoristaPorKm * kmFeitos;
  const custoVeiculo = eff.custoVeiculoPorKm * kmFeitos;

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
    litrosEspanha > 0 ? litrosEspanha * eff.precoCombRef - custoEspanha : 0;

  return {
    id: p.id,
    idRota: p.idRota,
    cliente: p.cliente,
    tipoVeiculo: p.tipoVeiculo,
    pesoTransportado: peso,
    nPaletes,
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
 * - PALETE_120X80/PALETE_120X100 -> nº paletes / capacidade desse tipo
 * - peso 0, VAZIO ou LEVE -> 1
 * - CAMIAO -> peso / capacidade camião
 * - CAMIAO+REBOQUE -> peso / capacidade reboque
 *
 * O coeficiente NÃO está limitado a 1: cargas acima da capacidade (sobrecarga)
 * dão coeficiente > 1, refletindo que a carga "pesa" mais do que um camião cheio.
 *
 * `nPaletes` é opcional (default 0) para não quebrar chamadas existentes que
 * só passam peso — só é usado nos 2 tipos de palete.
 */
export function coeficienteReal(
  tipoVeiculo: string,
  peso: number,
  cap: ComCapacidades,
  nPaletes = 0,
): number {
  if (tipoVeiculo === "PALETE_120X80") {
    return nPaletes > 0 ? nPaletes / cap.capacidadePaleteA : 1;
  }
  if (tipoVeiculo === "PALETE_120X100") {
    return nPaletes > 0 ? nPaletes / cap.capacidadePaleteB : 1;
  }
  if (peso <= 0 || tipoVeiculo === "VAZIO" || tipoVeiculo === "LEVE") {
    return 1;
  }
  if (tipoVeiculo === "CAMIAO") {
    return peso / cap.capacidadeCamiao;
  }
  if (tipoVeiculo === "CAMIAO+REBOQUE") {
    return peso / cap.capacidadeReboque;
  }
  return 1;
}
