import { consumoPorCarga, valorPortagem } from "./lookups";
import type {
  CustosDerivados,
  EscalaoConsumo,
  PaleteLinha,
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
    tabelaConsumo: ctx.tabelaConsumo,
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

/** Forma mínima aceite pelos helpers de peso aproximado abaixo — aceita tanto
 * `ParagemInput` como a paragem crua da BD (ex. em `ParagemEditor.tsx`). */
interface ComPesoAproximado {
  pesoAproximado?: number | null;
  pesoAproximadoCarregado?: number | null;
  recolha?: boolean | null;
  paletes?: PaleteLinha[] | null;
}

/**
 * true quando esta paragem, registada ANTES de `pesoAproximadoCarregado`
 * existir, era uma RECOLHA pura — nesse caso o valor recolhido vinha no campo
 * antigo `pesoAproximado`. Mesma regra de sentido de `linhasCargaParagem`
 * (lib/calc/cargaRota.ts): sem nenhuma linha `ENTREGA` explícita numa paragem
 * `recolha=true`, é tudo recolha.
 */
function recolhaPuraSemCarregadoProprio(p: ComPesoAproximado): boolean {
  if (!p.recolha || p.pesoAproximadoCarregado != null) return false;
  const temEntrega = Array.isArray(p.paletes) && p.paletes.some((l) => (l.sentido ?? "RECOLHA") === "ENTREGA");
  return !temEntrega;
}

/** Peso aproximado DESCARREGADO efetivo (kg) — ver `ParagemInput.pesoAproximado`. */
export function pesoAproximadoDescarregado(p: ComPesoAproximado): number {
  if (recolhaPuraSemCarregadoProprio(p)) return 0; // valor antigo já contado como carregado abaixo
  return p.pesoAproximado ?? 0;
}

/** Peso aproximado RECOLHIDO/carregado efetivo (kg) — ver `ParagemInput.pesoAproximadoCarregado`. */
export function pesoAproximadoCarregadoEfetivo(p: ComPesoAproximado): number {
  if (p.pesoAproximadoCarregado != null) return p.pesoAproximadoCarregado;
  if (recolhaPuraSemCarregadoProprio(p)) return p.pesoAproximado ?? 0;
  return 0; // DESCARGA pura, ou MISTA antiga sem carregado conhecido (limitação assumida)
}

/** Paralelo a `pesoTransportado()`: maior entre descarregado/carregado — usado
 * como fallback sem correção de rota (orçamentos, ou linhas/segmentos de 1
 * paragem em `pesosAproximadosEmTransito`). */
export function pesoAproximadoTransportado(p: ComPesoAproximado): number {
  return Math.max(pesoAproximadoDescarregado(p), pesoAproximadoCarregadoEfetivo(p));
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
 * Linhas de palete "novas" (dimensão própria congelada) de uma paragem: o array
 * `paletes` (vários tamanhos na mesma paragem, 2026-09+) ou, em fallback, uma
 * linha só a partir dos campos escalares. `[]` = paragem sem palete de dimensão
 * própria (cai no caminho legado `tipoPalete`/`volume` ou no peso).
 */
export function linhasPaleteEfetivas(p: {
  paletes?: PaleteLinha[] | null;
  tipoPaleteId?: number | null;
  paleteComprimentoMm?: number | null;
  paleteLarguraMm?: number | null;
  nPaletes?: number;
}): PaleteLinha[] {
  if (p.paletes && p.paletes.length > 0) {
    return p.paletes.filter((l) => l.comprimentoMm > 0 && l.larguraMm > 0);
  }
  if (p.paleteComprimentoMm && p.paleteLarguraMm) {
    return [
      {
        tipoPaleteId: p.tipoPaleteId ?? null,
        comprimentoMm: p.paleteComprimentoMm,
        larguraMm: p.paleteLarguraMm,
        nPaletes: p.nPaletes ?? 0,
      },
    ];
  }
  return [];
}

/**
 * Coeficiente de carga da parte "paletes por dimensão": soma, por linha,
 * nº paletes / capacidade dessa dimensão (fração do camião que cada linha
 * ocupa). As meias-paletes (0,5 cada, sem dimensão própria) usam a capacidade
 * da 1.ª linha. Com uma só linha é matematicamente idêntico ao cálculo antigo
 * `(nPaletes + nMeias×0,5) / capacidade`. Devolve 0 quando não há paletes nem
 * capacidade — o chamador decide se isso vira 1 (rateio) ou fica 0 (métrica).
 */
function coefPaletesDimensao(
  tipoVeiculo: string,
  linhas: PaleteLinha[],
  nMeiasPaletes: number,
  cap: ComCapacidadesArea,
): number {
  let coef = 0;
  for (const l of linhas) {
    const c = capacidadePaleteDimensoes(tipoVeiculo, l.comprimentoMm, l.larguraMm, cap);
    if (c > 0) coef += (l.nPaletes || 0) / c;
  }
  if (nMeiasPaletes > 0) {
    const capRef = capacidadePaleteDimensoes(tipoVeiculo, linhas[0].comprimentoMm, linhas[0].larguraMm, cap);
    if (capRef > 0) coef += (nMeiasPaletes * 0.5) / capRef;
  }
  return coef;
}

/**
 * Calcula todos os valores de uma paragem (§4.1). Funções puras, sem efeitos.
 * Trata peso 0 e dados em falta de forma graciosa (sem divisão por zero).
 */
export function calcularParagem(p: ParagemInput, ctx: ContextoCalculo): ParagemCalc {
  const { tabelaPortagens } = ctx;
  const eff = efetivos(p, ctx);

  const kmFeitos = (p.kmFinal || 0) - (p.kmInicial || 0);
  const peso = pesoTransportado(p);
  // Peso realmente a bordo durante este troço (rota com vários clientes ->
  // camião mais pesado nos primeiros troços); por defeito é o peso próprio
  // (paragem isolada / orçamento, comportamento inalterado). Só entra no
  // consumo — coeficienteCarga/precoPorKg continuam a refletir o peso
  // próprio do cliente (rateio inalterado, ver lib/calc/perRoute.ts).
  const pesoParaConsumo = p.pesoEmTransito ?? peso;
  const nMeiasPaletes = p.nMeiasPaletes || 0;

  // Palete desta paragem: dimensão própria congelada (2026-08-28 em diante, único
  // caminho para paragens novas) tem sempre prioridade sobre o caminho legado
  // (tipoPalete string / volume, ou o fallback de tipoVeiculo literal
  // pré-migração) — ver `paleteEfetiva`. Decidido só pela presença das
  // dimensões, nunca por `p.volume` (que fica vestígio, só para paragens antigas).
  // `linhasNovas` cobre 1 ou várias linhas de palete (tamanhos diferentes na
  // mesma paragem, 2026-09+); vazio = cai no legado/peso.
  const linhasNovas = linhasPaleteEfetivas(p);
  const paleteNova = linhasNovas.length > 0;
  const legado = paleteEfetiva(p.tipoVeiculo, p.volume, p.tipoPalete);
  const ehPalete = paleteNova ? true : legado.ehPalete;
  // nPaletes efetivo (agregado das linhas quando há várias); as meias contam
  // sempre a 0,5 e nunca ocupam base própria (não entram na capacidade).
  const nPaletes = paleteNova ? linhasNovas.reduce((s, l) => s + (l.nPaletes || 0), 0) : p.nPaletes || 0;
  const nPaletesEquivalente = nPaletes + nMeiasPaletes * 0.5;

  // Coeficiente de carga: paletes -> nº paletes/capacidade (área, se dimensão
  // própria; senão nº fixo legado) — uma palete leve ocupa o mesmo "slot" físico,
  // o peso não reflete a ocupação real; senão peso / capacidade (kg).
  const coeficienteCarga: number = paleteNova
    ? coefPaletesDimensao(p.tipoVeiculo, linhasNovas, nMeiasPaletes, eff)
    : legado.ehPalete
      ? nPaletesEquivalente / capacidadePalete(legado.tipoVeiculoEfetivo, legado.tipo, eff)
      : peso / capacidade(p.tipoVeiculo, eff);

  // Consumo (lookup aproximado) e combustível. Paletes: o que importa para o
  // rateio é a ocupação em espaço/base, não o peso — mas o consumo passa a usar
  // o peso aproximado (2026-08-28), quando preenchido, tal como a carga normal.
  // Sem peso aproximado -> trata como vazio (0), como sempre foi. Numa rota com
  // várias paragens, `pesoAproximadoEmTransito` (peso em trânsito, calculado ao
  // nível da rota a partir de descarregado/carregado — ver `pesosAproximadosEmTransito`
  // em lib/calc/perRoute.ts) tem prioridade sobre o peso próprio desta paragem
  // isolada, mesmo princípio de `pesoParaConsumo` acima para o modo por kg.
  const pesoAproximadoParaConsumo = p.pesoAproximadoEmTransito ?? pesoAproximadoTransportado(p);
  const consumoL100 = consumoPorCarga(ehPalete ? pesoAproximadoParaConsumo : pesoParaConsumo, eff.tabelaConsumo ?? []);
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
    rateioManual: p.rateioManual ?? null,
    pesoTransportado: peso,
    volume: ehPalete,
    tipoPalete: !paleteNova && legado.ehPalete ? legado.tipo : null,
    nPaletes,
    nMeiasPaletes: p.nMeiasPaletes || 0,
    tipoPaleteId: p.tipoPaleteId ?? null,
    paleteComprimentoMm: p.paleteComprimentoMm ?? null,
    paleteLarguraMm: p.paleteLarguraMm ?? null,
    paletes: p.paletes && p.paletes.length > 0 ? p.paletes : null,
    pesoAproximado: p.pesoAproximado ?? null,
    pesoAproximadoCarregado: p.pesoAproximadoCarregado ?? null,
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
 * `nPaletes`/`volume`/`tipoPalete`/`paleteComprimentoMm`/`paleteLarguraMm`/
 * `nMeiasPaletes` são opcionais (default 0/false/null) para não quebrar
 * chamadas existentes que só passam peso — e para continuar a aceitar, em
 * fallback, `tipoVeiculo` ainda literalmente "PALETE_120X80"/"PALETE_120X100"
 * (dados anteriores à migração para `volume`). `paleteComprimentoMm`/
 * `LarguraMm`, quando presentes, têm sempre prioridade sobre `volume`/
 * `tipoPalete` — mesma regra de `calcularParagem` em cima. `nMeiasPaletes`
 * (paletes empilhadas sem base própria) só entra no numerador (0,5 cada),
 * nunca na capacidade — mesmo princípio de `calcularParagem`.
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
  nMeiasPaletes = 0,
  paletes: PaleteLinha[] | null = null,
): number {
  const nPaletesEquivalente = nPaletes + nMeiasPaletes * 0.5;
  // Palete por dimensão — 1 linha (paleteComprimento/Largura) ou várias
  // (`paletes`, tamanhos diferentes na mesma paragem).
  const linhasNovas = linhasPaleteEfetivas({ paletes, paleteComprimentoMm, paleteLarguraMm, nPaletes });
  if (linhasNovas.length > 0) {
    const totalPaletes = linhasNovas.reduce((s, l) => s + (l.nPaletes || 0), 0);
    if (totalPaletes <= 0 && nMeiasPaletes <= 0) return 1;
    return coefPaletesDimensao(tipoVeiculo, linhasNovas, nMeiasPaletes, cap);
  }
  const { ehPalete, tipo, tipoVeiculoEfetivo } = paleteEfetiva(tipoVeiculo, volume, tipoPalete);
  if (ehPalete) {
    return nPaletes > 0 || nMeiasPaletes > 0
      ? nPaletesEquivalente / capacidadePalete(tipoVeiculoEfetivo, tipo, cap)
      : 1;
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
