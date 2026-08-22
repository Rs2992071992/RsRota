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
  | "capacidadeCamiao"
  | "capacidadeReboque"
  | "capacidadePaleteA"
  | "capacidadePaleteB"
  | "capacidadePaleteACamiao"
  | "capacidadePaleteBCamiao"
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
    capacidadePaleteACamiao: ctx.params.capacidadePaleteACamiao,
    capacidadePaleteBCamiao: ctx.params.capacidadePaleteBCamiao,
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
 * Decide se uma paragem é de volume (paletes) e com que tipo de palete/
 * veículo efetivo calcular a capacidade. Trata dois casos:
 * - `volume=true` (fluxo atual): tipo = `tipoPalete` (default 120x80 se em
 *   falta), veículo efetivo = o próprio `tipoVeiculo` escolhido (CAMIAO vs
 *   CAMIAO+REBOQUE já distingue "só camião" de "camião+reboque").
 * - Fallback para dados anteriores à migração (`tipoVeiculo` ainda
 *   literalmente "PALETE_120X80"/"PALETE_120X100"): esses valores sempre
 *   significaram camião+reboque (nunca existiu a distinção), por isso o
 *   veículo efetivo força-se a "CAMIAO+REBOQUE".
 */
function paleteEfetiva(
  tipoVeiculo: string,
  volume: boolean | undefined,
  tipoPalete: string | null | undefined,
): { ehPalete: boolean; tipo: string; tipoVeiculoEfetivo: string } {
  if (volume) {
    return { ehPalete: true, tipo: tipoPalete ?? "PALETE_120X80", tipoVeiculoEfetivo: tipoVeiculo };
  }
  if (tipoVeiculo === "PALETE_120X80" || tipoVeiculo === "PALETE_120X100") {
    return { ehPalete: true, tipo: tipoVeiculo, tipoVeiculoEfetivo: "CAMIAO+REBOQUE" };
  }
  return { ehPalete: false, tipo: "", tipoVeiculoEfetivo: tipoVeiculo };
}

/** Capacidade de paletes: escolhe A/B pelo tipo, e o par "camião+reboque" vs
 * "só camião" pelo veículo efetivo (ver `paleteEfetiva`). */
function capacidadePalete(tipoVeiculoEfetivo: string, tipo: string, cap: ComCapacidades): number {
  const reboque = tipoVeiculoEfetivo === "CAMIAO+REBOQUE";
  return tipo === "PALETE_120X100"
    ? reboque
      ? cap.capacidadePaleteB
      : cap.capacidadePaleteBCamiao
    : reboque
      ? cap.capacidadePaleteA
      : cap.capacidadePaleteACamiao;
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
  // Peso realmente a bordo durante este troço (rota com vários clientes ->
  // camião mais pesado nos primeiros troços); por defeito é o peso próprio
  // (paragem isolada / orçamento, comportamento inalterado). Só entra no
  // consumo — coeficienteCarga/precoPorKg continuam a refletir o peso
  // próprio do cliente (rateio inalterado, ver lib/calc/perRoute.ts).
  const pesoParaConsumo = p.pesoEmTransito ?? peso;
  const nPaletes = p.nPaletes || 0;
  const { ehPalete, tipo: tipoPaleteEfetivo, tipoVeiculoEfetivo } = paleteEfetiva(
    p.tipoVeiculo,
    p.volume,
    p.tipoPalete,
  );

  // Coeficiente de carga: paletes -> nº paletes/capacidade desse tipo (uma
  // palete leve ocupa o mesmo "slot" físico, o peso não reflete a ocupação
  // real); senão peso / capacidade (kg).
  const coeficienteCarga: number = ehPalete
    ? nPaletes / capacidadePalete(tipoVeiculoEfetivo, tipoPaleteEfetivo, eff)
    : peso / capacidade(p.tipoVeiculo, eff);

  // Consumo (lookup aproximado) e combustível. Paletes: o que importa é a
  // ocupação em espaço/base, não o peso (cargas leves) — o consumo é tratado
  // sempre como se o veículo fosse vazio, independentemente do escalão de
  // peso configurado na tabela (garante isto explicitamente, não depende de
  // o peso das paletes calhar sempre no primeiro escalão da tabela).
  const consumoL100 = consumoPorCarga(ehPalete ? 0 : pesoParaConsumo, tabelaConsumo);
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

  // Espanha (informativo): poupança vs preço de referência desta rota
  // (precoCombUsado já aplica o override por rota se existir, senão o
  // parâmetro global — mesmo preço usado para custoCombustivel acima).
  const litrosEspanha = p.litrosEspanha || 0;
  const custoEspanha = p.custoEspanha || 0;
  const poupancaEspanha =
    litrosEspanha > 0 ? litrosEspanha * precoCombUsado - custoEspanha : 0;

  return {
    id: p.id,
    idRota: p.idRota,
    cliente: p.cliente,
    tipoVeiculo: p.tipoVeiculo,
    recolha: p.recolha ?? false,
    faturarCliente: p.faturarCliente ?? null,
    pesoTransportado: peso,
    volume: ehPalete,
    tipoPalete: ehPalete ? tipoPaleteEfetivo : null,
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
 * - volume (paletes) -> nº paletes / capacidade desse tipo × veículo
 * - peso 0 ou VAZIO -> 1
 * - CAMIAO -> peso / capacidade camião
 * - CAMIAO+REBOQUE -> peso / capacidade reboque
 *
 * O coeficiente NÃO está limitado a 1: cargas acima da capacidade (sobrecarga)
 * dão coeficiente > 1, refletindo que a carga "pesa" mais do que um camião cheio.
 *
 * `nPaletes`/`volume`/`tipoPalete` são opcionais (default 0/false/null) para
 * não quebrar chamadas existentes que só passam peso — e para continuar a
 * aceitar, em fallback, `tipoVeiculo` ainda literalmente "PALETE_120X80"/
 * "PALETE_120X100" (dados anteriores à migração para `volume`).
 */
export function coeficienteReal(
  tipoVeiculo: string,
  peso: number,
  cap: ComCapacidades,
  nPaletes = 0,
  volume = false,
  tipoPalete: string | null = null,
): number {
  const { ehPalete, tipo, tipoVeiculoEfetivo } = paleteEfetiva(tipoVeiculo, volume, tipoPalete);
  if (ehPalete) {
    return nPaletes > 0 ? nPaletes / capacidadePalete(tipoVeiculoEfetivo, tipo, cap) : 1;
  }
  if (peso <= 0 || tipoVeiculo === "VAZIO") {
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
