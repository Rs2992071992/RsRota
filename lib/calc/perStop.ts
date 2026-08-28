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

/** `ComCapacidades` + a caixa de carga (mm) usada no rateio por dimensão (2026-08-28). */
type ComCapacidadesArea = ComCapacidades &
  Pick<
    ParagemSnapshot,
    | "caixaComprimentoMm"
    | "caixaLarguraMm"
    | "caixaReboqueComprimentoMm"
    | "caixaReboqueLarguraMm"
    | "fatorOcupacaoPalete"
  >;

/**
 * Custos efetivos de uma paragem: usa o snapshot congelado quando existe, senão
 * cai no contexto atual (parâmetros globais). Centraliza a regra "por-motorista/
 * por-veículo + histórico estável" para o resto do motor.
 *
 * O snapshot pode ser mais antigo do que campos entretanto acrescentados a
 * `ParagemSnapshot` (ex.: capacidade de paletes, criada só a partir de
 * 2026-07-14 — um snapshot congelado antes disso não tem esses campos).
 * Por isso faz-se sempre o merge sobre os defaults do contexto atual: os
 * valores congelados prevalecem onde existirem, e só os campos em falta
 * caem no contexto atual — nunca `undefined`/`NaN` por um snapshot antigo
 * incompleto.
 */
export function efetivos(p: ParagemInput, ctx: ContextoCalculo): ParagemSnapshot {
  const defaults: ParagemSnapshot = {
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
  return p.snapshot ? { ...defaults, ...p.snapshot } : defaults;
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
 * "só camião" pelo veículo efetivo (ver `paleteEfetiva`).
 * ⚠️ Legado — só para paragens com `tipoPalete` string (anteriores a 2026-08-28).
 * Paragens novas usam `capacidadePaleteDimensoes` abaixo. */
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
 * Nº de paletes de uma dimensão (mm) que cabem numa caixa (mm), testando as 2
 * orientações (a palete pode ficar de lado). Fórmula fechada de "ladrilhamento"
 * — correta para UM tipo a preencher a caixa sozinho (o caso de uma paragem: 1
 * tipo, 1 quantidade); não tenta resolver o problema mais geral de vários tipos
 * a disputar espaço por ordem de chegada (esse é `lib/calc/paletePacking.ts`,
 * usado só no módulo "Cargas").
 */
export function paletesQueCabem(
  caixaComprimentoMm: number,
  caixaLarguraMm: number,
  paleteComprimentoMm: number,
  paleteLarguraMm: number,
): number {
  const semRotacao =
    Math.floor(caixaLarguraMm / paleteLarguraMm) * Math.floor(caixaComprimentoMm / paleteComprimentoMm);
  const comRotacao =
    Math.floor(caixaLarguraMm / paleteComprimentoMm) * Math.floor(caixaComprimentoMm / paleteLarguraMm);
  return Math.max(semRotacao, comRotacao);
}

/**
 * Capacidade de paletes por dimensão (2026-08-28 em diante, substitui
 * `capacidadePalete()` para paragens com dimensões próprias congeladas). Soma a
 * caixa do veículo com a do seu reboque habitual (só quando `tipoVeiculoEfetivo`
 * = CAMIAO+REBOQUE e a caixa-reboque está configurada no snapshot), e aplica o
 * fator de ocupação do veículo (1 = confiar na geometria, ver
 * `Veiculo.fatorOcupacaoPalete`). Sem caixa do veículo configurada -> 0 (o
 * chamador trata como capacidade desconhecida, nunca `Infinity`/`NaN`).
 */
function capacidadePaleteDimensoes(
  tipoVeiculoEfetivo: string,
  paleteComprimentoMm: number,
  paleteLarguraMm: number,
  cap: ComCapacidadesArea,
): number {
  if (!cap.caixaComprimentoMm || !cap.caixaLarguraMm) return 0;
  let total = paletesQueCabem(cap.caixaComprimentoMm, cap.caixaLarguraMm, paleteComprimentoMm, paleteLarguraMm);
  if (tipoVeiculoEfetivo === "CAMIAO+REBOQUE" && cap.caixaReboqueComprimentoMm && cap.caixaReboqueLarguraMm) {
    total += paletesQueCabem(
      cap.caixaReboqueComprimentoMm,
      cap.caixaReboqueLarguraMm,
      paleteComprimentoMm,
      paleteLarguraMm,
    );
  }
  return Math.floor(total * (cap.fatorOcupacaoPalete ?? 1));
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

  // Palete desta paragem: dimensão própria congelada (2026-08-28 em diante, único
  // caminho para paragens novas) tem sempre prioridade sobre o caminho legado
  // (tipoPalete string / volume, ou o fallback de tipoVeiculo literal
  // pré-migração) — ver `paleteEfetiva`. Decidido só pela presença das
  // dimensões, nunca por `p.volume` (que fica vestígio, só para paragens antigas).
  const paleteNova =
    p.paleteComprimentoMm && p.paleteLarguraMm
      ? { comprimentoMm: p.paleteComprimentoMm, larguraMm: p.paleteLarguraMm }
      : null;
  const legado = paleteEfetiva(p.tipoVeiculo, p.volume, p.tipoPalete);
  const ehPalete = paleteNova ? true : legado.ehPalete;

  // Coeficiente de carga: paletes -> nº paletes/capacidade (área, se dimensão
  // própria; senão nº fixo legado) — uma palete leve ocupa o mesmo "slot" físico,
  // o peso não reflete a ocupação real; senão peso / capacidade (kg).
  const capacidadeNova = paleteNova
    ? capacidadePaleteDimensoes(p.tipoVeiculo, paleteNova.comprimentoMm, paleteNova.larguraMm, eff)
    : 0;
  const coeficienteCarga: number = paleteNova
    ? capacidadeNova > 0
      ? nPaletes / capacidadeNova
      : 0
    : legado.ehPalete
      ? nPaletes / capacidadePalete(legado.tipoVeiculoEfetivo, legado.tipo, eff)
      : peso / capacidade(p.tipoVeiculo, eff);

  // Consumo (lookup aproximado) e combustível. Paletes: o que importa para o
  // rateio é a ocupação em espaço/base, não o peso — mas o consumo passa a usar
  // o peso aproximado (2026-08-28), quando preenchido, tal como a carga normal.
  // Sem peso aproximado -> trata como vazio (0), como sempre foi.
  const consumoL100 = consumoPorCarga(ehPalete ? p.pesoAproximado || 0 : pesoParaConsumo, tabelaConsumo);
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
    tipoPalete: !paleteNova && legado.ehPalete ? legado.tipo : null,
    nPaletes,
    tipoPaleteId: p.tipoPaleteId ?? null,
    paleteComprimentoMm: p.paleteComprimentoMm ?? null,
    paleteLarguraMm: p.paleteLarguraMm ?? null,
    pesoAproximado: p.pesoAproximado ?? null,
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
 * - palete com dimensão própria (2026-08-28+) -> nº paletes / capacidade por área
 * - volume/tipoPalete legado -> nº paletes / capacidade fixa desse tipo
 * - peso 0 ou VAZIO -> 1
 * - CAMIAO -> peso / capacidade camião
 * - CAMIAO+REBOQUE -> peso / capacidade reboque
 *
 * O coeficiente NÃO está limitado a 1: cargas acima da capacidade (sobrecarga)
 * dão coeficiente > 1, refletindo que a carga "pesa" mais do que um camião cheio.
 *
 * `nPaletes`/`volume`/`tipoPalete`/`paleteComprimentoMm`/`paleteLarguraMm` são
 * opcionais (default 0/false/null) para não quebrar chamadas existentes que só
 * passam peso — e para continuar a aceitar, em fallback, `tipoVeiculo` ainda
 * literalmente "PALETE_120X80"/"PALETE_120X100" (dados anteriores à migração
 * para `volume`). `paleteComprimentoMm`/`LarguraMm`, quando presentes, têm
 * sempre prioridade sobre `volume`/`tipoPalete` — mesma regra de
 * `calcularParagem` em cima.
 */
export function coeficienteReal(
  tipoVeiculo: string,
  peso: number,
  cap: ComCapacidadesArea,
  nPaletes = 0,
  volume = false,
  tipoPalete: string | null = null,
  paleteComprimentoMm: number | null = null,
  paleteLarguraMm: number | null = null,
): number {
  if (paleteComprimentoMm && paleteLarguraMm) {
    if (nPaletes <= 0) return 1;
    const capacidade = capacidadePaleteDimensoes(tipoVeiculo, paleteComprimentoMm, paleteLarguraMm, cap);
    return capacidade > 0 ? nPaletes / capacidade : 0;
  }
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
