// Motor de empacotamento de paletes em caixas (veículo/reboque). Puro
// TypeScript, sem dependências de framework/DB (ver convenção em
// lib/calc/perStop.ts).
//
// Empacotamento 2D com rotação. `empacotar` corre DOIS algoritmos e fica com o
// que coloca mais paletes:
//   - por faixas (prateleiras): grelha regular, ótimo para carga uniforme;
//   - MaxRects (maximal rectangles, Best-Short-Side-Fit): apanha faixas lado a
//     lado a ritmos diferentes e cargas mistas.
// As unidades são processadas por ordem de chegada (`ordem`) e NUNCA
// reordenadas. Cada algoritmo é, isoladamente, estável a anexar unidades no
// fim (não reflui as já colocadas) — é o que sustenta `estimarQuantosCabem`.
// Sem espaço numa caixa, tenta-se a caixa seguinte (veículo -> reboque).

export interface CaixaInput {
  /** Identifica a caixa (ex.: "veiculo" ou o id do reboque anexado). */
  id: string;
  label: string;
  /** Eixo "para dentro" da caixa (fundo do camião) — onde a carga avança. */
  comprimentoMm: number;
  /** Eixo "ao través" da caixa — onde as paletes ficam lado a lado. */
  larguraMm: number;
}

/** Orientação forçada de uma palete na planta de carga.
 * AUTO = o motor escolhe; COMPRIDO = comprimento ao longo do camião
 * (rotacionado:false); TRAVES = atravessada (rotacionado:true). */
export type OrientacaoPalete = "AUTO" | "COMPRIDO" | "TRAVES";

export interface PaleteUnidade {
  pedidoId: number;
  clienteId: number;
  clienteNome: string;
  tipoPaleteId: number;
  tipoPaleteNome: string;
  comprimentoMm: number;
  larguraMm: number;
  ordem: number;
  /** Default AUTO se ausente — mantém válidas as chamadas antigas. */
  orientacao?: OrientacaoPalete;
}

export interface PaleteColocada extends PaleteUnidade {
  caixaId: string;
  rotacionado: boolean;
  /** Canto da palete: `x` ao longo da largura da caixa, `y` ao longo do comprimento. */
  x: number;
  y: number;
  /** Dimensões ocupadas nos eixos da caixa, já com a orientação aplicada. */
  larguraOcupada: number;
  comprimentoOcupado: number;
}

export type MotivoNaoColocado = "SEM_ESPACO" | "NAO_CABE_ORIENTACAO";

export interface PaleteNaoColocada {
  unidade: PaleteUnidade;
  motivo: MotivoNaoColocado;
}

export interface CaixaResultado {
  caixa: CaixaInput;
  /** Todas as paletes colocadas nesta caixa, por ordem de colocação. */
  itens: PaleteColocada[];
  areaUsadaMm2: number;
  areaTotalMm2: number;
  /** Ponto mais fundo usado na caixa (max y + comprimentoOcupado). */
  comprimentoUsadoMm: number;
}

export interface ResultadoPacking {
  caixas: CaixaResultado[];
  colocados: PaleteColocada[];
  naoColocados: PaleteNaoColocada[];
}

// --- MaxRects --------------------------------------------------------------

interface RectLivre {
  x: number;
  y: number;
  larg: number;
  comp: number;
}

interface Orientacao {
  larg: number;
  comp: number;
  rotacionado: boolean;
}

/** As orientações da palete que cabem nas dimensões da caixa vazia. */
function orientacoesQueCabem(caixa: CaixaInput, u: PaleteUnidade): Orientacao[] {
  const cand: Orientacao[] = [
    { larg: u.larguraMm, comp: u.comprimentoMm, rotacionado: false },
    { larg: u.comprimentoMm, comp: u.larguraMm, rotacionado: true },
  ];
  return cand.filter((o) => o.larg <= caixa.larguraMm && o.comp <= caixa.comprimentoMm);
}

/** `true` se `o` é a orientação preferida da linha (COMPRIDO = não rotacionada;
 * TRAVES = rotacionada). AUTO/ausente → nunca "preferida". */
function ehPreferida(o: Orientacao, u: PaleteUnidade): boolean {
  return (
    (u.orientacao === "COMPRIDO" && !o.rotacionado) ||
    (u.orientacao === "TRAVES" && o.rotacionado)
  );
}

interface Posicao {
  x: number;
  y: number;
  /** Best-Short-Side-Fit: menor sobra num dos lados do retângulo livre usado. */
  shortFit: number;
}

/** Melhor posição para um retângulo `larg×comp` entre os livres (Best-Short-
 * Side-Fit; desempate: menor y = mais ao fundo, depois menor x). `null` se não
 * cabe em nenhum livre. */
function melhorPosicao(livres: RectLivre[], larg: number, comp: number): Posicao | null {
  let melhor: Posicao | null = null;
  for (const r of livres) {
    if (larg > r.larg || comp > r.comp) continue;
    const cand: Posicao = { x: r.x, y: r.y, shortFit: Math.min(r.larg - larg, r.comp - comp) };
    if (
      melhor === null ||
      cand.shortFit < melhor.shortFit ||
      (cand.shortFit === melhor.shortFit && cand.y < melhor.y) ||
      (cand.shortFit === melhor.shortFit && cand.y === melhor.y && cand.x < melhor.x)
    ) {
      melhor = cand;
    }
  }
  return melhor;
}

function intersecta(r: RectLivre, px: number, py: number, pl: number, pc: number): boolean {
  return px < r.x + r.larg && px + pl > r.x && py < r.y + r.comp && py + pc > r.y;
}

function contido(a: RectLivre, b: RectLivre): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.larg <= b.x + b.larg && a.y + a.comp <= b.y + b.comp;
}

/** Substitui cada livre que interseta a palete pelos sub-retângulos maximais
 * que sobram à esquerda/direita/frente/trás da palete. */
function dividirLivres(livres: RectLivre[], px: number, py: number, pl: number, pc: number): RectLivre[] {
  const out: RectLivre[] = [];
  for (const r of livres) {
    if (!intersecta(r, px, py, pl, pc)) {
      out.push(r);
      continue;
    }
    if (px > r.x) out.push({ x: r.x, y: r.y, larg: px - r.x, comp: r.comp });
    if (px + pl < r.x + r.larg)
      out.push({ x: px + pl, y: r.y, larg: r.x + r.larg - (px + pl), comp: r.comp });
    if (py > r.y) out.push({ x: r.x, y: r.y, larg: r.larg, comp: py - r.y });
    if (py + pc < r.y + r.comp)
      out.push({ x: r.x, y: py + pc, larg: r.larg, comp: r.y + r.comp - (py + pc) });
  }
  return out;
}

/** Remove livres degenerados e os que estão contidos noutro (mantendo, entre
 * duplicados exatos, só o de índice menor). */
function podar(rects: RectLivre[]): RectLivre[] {
  const out: RectLivre[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.larg <= 0 || r.comp <= 0) continue;
    let redundante = false;
    for (let j = 0; j < rects.length && !redundante; j++) {
      if (i === j) continue;
      const o = rects[j];
      if (!contido(r, o)) continue;
      const iguais = r.x === o.x && r.y === o.y && r.larg === o.larg && r.comp === o.comp;
      if (!iguais || j < i) redundante = true;
    }
    if (!redundante) out.push(r);
  }
  return out;
}

function montarCaixaResultado(e: { caixa: CaixaInput; itens: PaleteColocada[] }): CaixaResultado {
  return {
    caixa: e.caixa,
    itens: e.itens,
    areaUsadaMm2: e.itens.reduce((s, it) => s + it.larguraOcupada * it.comprimentoOcupado, 0),
    areaTotalMm2: e.caixa.comprimentoMm * e.caixa.larguraMm,
    comprimentoUsadoMm: e.itens.reduce((m, it) => Math.max(m, it.y + it.comprimentoOcupado), 0),
  };
}

interface EstadoMaxRects {
  caixa: CaixaInput;
  livres: RectLivre[];
  itens: PaleteColocada[];
}

function tentarColocar(estado: EstadoMaxRects, u: PaleteUnidade): PaleteColocada | null {
  const orients = orientacoesQueCabem(estado.caixa, u);
  if (orients.length === 0) return null; // nenhuma orientação cabe na caixa

  const avaliadas = orients
    .map((o) => ({ o, pos: melhorPosicao(estado.livres, o.larg, o.comp) }))
    .filter((a): a is { o: Orientacao; pos: Posicao } => a.pos !== null);
  if (avaliadas.length === 0) return null; // cabe na caixa vazia, mas não agora

  let escolhida: { o: Orientacao; pos: Posicao };
  const preferida = avaliadas.find((a) => ehPreferida(a.o, u));
  if (u.orientacao && preferida) {
    // Preferência forte: usa a orientação escolhida salvo se a outra couber
    // materialmente mais ao fundo (menos comprimento gasto).
    const outra = avaliadas.find((a) => a !== preferida);
    escolhida = !outra || preferida.pos.y <= outra.pos.y ? preferida : outra;
  } else {
    escolhida = avaliadas.reduce((m, a) => {
      if (a.pos.shortFit !== m.pos.shortFit) return a.pos.shortFit < m.pos.shortFit ? a : m;
      if (a.pos.y !== m.pos.y) return a.pos.y < m.pos.y ? a : m;
      if (a.pos.x !== m.pos.x) return a.pos.x < m.pos.x ? a : m;
      return m;
    });
  }

  const { o, pos } = escolhida;
  const colocada: PaleteColocada = {
    ...u,
    caixaId: estado.caixa.id,
    rotacionado: o.rotacionado,
    x: pos.x,
    y: pos.y,
    larguraOcupada: o.larg,
    comprimentoOcupado: o.comp,
  };
  estado.livres = podar(dividirLivres(estado.livres, pos.x, pos.y, o.larg, o.comp));
  estado.itens.push(colocada);
  return colocada;
}

/** Empacotamento MaxRects (bom para faixas a ritmos diferentes / cargas mistas). */
function empacotarMaxRects(caixas: CaixaInput[], unidades: PaleteUnidade[]): ResultadoPacking {
  const estados: EstadoMaxRects[] = caixas.map((caixa) => ({
    caixa,
    livres: [{ x: 0, y: 0, larg: caixa.larguraMm, comp: caixa.comprimentoMm }],
    itens: [],
  }));

  const colocados: PaleteColocada[] = [];
  const naoColocados: PaleteNaoColocada[] = [];

  for (const unidade of [...unidades].sort((a, b) => a.ordem - b.ordem)) {
    if (estados.length === 0) {
      naoColocados.push({ unidade, motivo: "SEM_ESPACO" });
      continue;
    }
    let colocada: PaleteColocada | null = null;
    let aceita = false;
    for (const estado of estados) {
      if (orientacoesQueCabem(estado.caixa, unidade).length > 0) aceita = true;
      colocada = tentarColocar(estado, unidade);
      if (colocada) break;
    }
    if (colocada) colocados.push(colocada);
    else naoColocados.push({ unidade, motivo: aceita ? "SEM_ESPACO" : "NAO_CABE_ORIENTACAO" });
  }

  return { caixas: estados.map(montarCaixaResultado), colocados, naoColocados };
}

// --- Empacotamento por faixas (prateleiras) --------------------------------
//
// Preenche linha a linha ao longo da largura da caixa; um cursor único avança
// no comprimento. Excelente para cargas de tamanho uniforme (grelha regular) e
// para o "truque" de abrir uma faixa rasa no fim quando a funda já não cabe;
// fraco quando a solução ótima precisa de faixas lado a lado a ritmos
// diferentes (aí é o MaxRects que ganha).

function preferenciaFaixa(caixa: CaixaInput, u: PaleteUnidade) {
  return (a: Orientacao, b: Orientacao): number => {
    const pa = ehPreferida(a, u) ? 0 : 1;
    const pb = ehPreferida(b, u) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (u.orientacao) return a.larg - b.larg;
    const contA = Math.floor(caixa.larguraMm / a.larg);
    const contB = Math.floor(caixa.larguraMm / b.larg);
    if (contB !== contA) return contB - contA;
    return a.comp - b.comp;
  };
}

interface EstadoFaixa {
  caixa: CaixaInput;
  cursorMm: number;
  aberta: { profundidadeMm: number; larguraUsadaMm: number } | null;
  itens: PaleteColocada[];
}

function fecharFaixa(e: EstadoFaixa): void {
  if (!e.aberta) return;
  e.cursorMm += e.aberta.profundidadeMm;
  e.aberta = null;
}

function tentarColocarFaixa(e: EstadoFaixa, u: PaleteUnidade): PaleteColocada | null {
  const cand = orientacoesQueCabem(e.caixa, u);
  if (cand.length === 0) return null;
  const pref = preferenciaFaixa(e.caixa, u);

  if (e.aberta) {
    const fa = e.aberta;
    const cabem = cand
      .filter((o) => o.comp <= fa.profundidadeMm && o.larg <= e.caixa.larguraMm - fa.larguraUsadaMm)
      .sort(pref);
    if (cabem.length > 0) {
      const o = cabem[0];
      const colocada: PaleteColocada = {
        ...u,
        caixaId: e.caixa.id,
        rotacionado: o.rotacionado,
        x: fa.larguraUsadaMm,
        y: e.cursorMm,
        larguraOcupada: o.larg,
        comprimentoOcupado: o.comp,
      };
      fa.larguraUsadaMm += o.larg;
      e.itens.push(colocada);
      return colocada;
    }
    fecharFaixa(e);
  }

  const escolhida = [...cand]
    .sort(pref)
    .find((o) => e.cursorMm + o.comp <= e.caixa.comprimentoMm);
  if (!escolhida) return null;

  // Reserva profundidade para encostar uma palete rodada quando a escolhida
  // sozinha não mete 2 na fila (evita 1 por fila com muito espaço ao lado).
  const alt = cand.find((o) => o.rotacionado !== escolhida.rotacionado);
  const encosta =
    alt !== undefined &&
    2 * escolhida.larg > e.caixa.larguraMm &&
    escolhida.larg + alt.larg <= e.caixa.larguraMm &&
    e.cursorMm + Math.max(escolhida.comp, alt.comp) <= e.caixa.comprimentoMm;
  const profundidadeMm = encosta ? Math.max(escolhida.comp, alt!.comp) : escolhida.comp;

  const colocada: PaleteColocada = {
    ...u,
    caixaId: e.caixa.id,
    rotacionado: escolhida.rotacionado,
    x: 0,
    y: e.cursorMm,
    larguraOcupada: escolhida.larg,
    comprimentoOcupado: escolhida.comp,
  };
  e.aberta = { profundidadeMm, larguraUsadaMm: escolhida.larg };
  e.itens.push(colocada);
  return colocada;
}

function empacotarPorFaixas(caixas: CaixaInput[], unidades: PaleteUnidade[]): ResultadoPacking {
  const estados: EstadoFaixa[] = caixas.map((caixa) => ({ caixa, cursorMm: 0, aberta: null, itens: [] }));
  const colocados: PaleteColocada[] = [];
  const naoColocados: PaleteNaoColocada[] = [];

  for (const unidade of [...unidades].sort((a, b) => a.ordem - b.ordem)) {
    if (estados.length === 0) {
      naoColocados.push({ unidade, motivo: "SEM_ESPACO" });
      continue;
    }
    let colocada: PaleteColocada | null = null;
    let aceita = false;
    for (const e of estados) {
      if (orientacoesQueCabem(e.caixa, unidade).length > 0) aceita = true;
      colocada = tentarColocarFaixa(e, unidade);
      if (colocada) break;
    }
    if (colocada) colocados.push(colocada);
    else naoColocados.push({ unidade, motivo: aceita ? "SEM_ESPACO" : "NAO_CABE_ORIENTACAO" });
  }

  for (const e of estados) fecharFaixa(e);
  return { caixas: estados.map(montarCaixaResultado), colocados, naoColocados };
}

/**
 * Empacota as unidades nas caixas dadas, por ordem de chegada (`ordem`).
 * Caixas na ordem em que o overflow deve ser tentado (veículo, depois reboque).
 *
 * Corre os dois algoritmos (faixas + MaxRects) e devolve o que coloca mais
 * paletes — em empate, o de faixas (grelha mais regular). Cada algoritmo,
 * isoladamente, é estável a anexar unidades no fim (não reflui as já colocadas).
 */
export function empacotar(caixas: CaixaInput[], unidades: PaleteUnidade[]): ResultadoPacking {
  const porFaixas = empacotarPorFaixas(caixas, unidades);
  const maxRects = empacotarMaxRects(caixas, unidades);
  return maxRects.colocados.length > porFaixas.colocados.length ? maxRects : porFaixas;
}

export interface PedidoParaExpandir {
  pedidoId: number;
  clienteId: number;
  clienteNome: string;
  tipoPaleteId: number;
  tipoPaleteNome: string;
  comprimentoMm: number;
  larguraMm: number;
  ordem: number;
  quantidade: number;
  orientacao?: OrientacaoPalete;
}

/** Expande pedidos (com quantidade) em unidades individuais (1 por palete física),
 * reescrevendo `ordem` pela posição no array — usado quando a ordem de entrada já
 * reflete a sequência de carga pretendida (`empacotar` reordena por `ordem`). */
function expandirNaOrdem(pedidos: PedidoParaExpandir[]): PaleteUnidade[] {
  return expandirPedidosEmUnidades(pedidos.map((p, i) => ({ ...p, ordem: i + 1 })));
}

/** Expande pedidos (com quantidade) em unidades individuais (1 por palete física). */
export function expandirPedidosEmUnidades(pedidos: PedidoParaExpandir[]): PaleteUnidade[] {
  const unidades: PaleteUnidade[] = [];
  for (const p of pedidos) {
    for (let i = 0; i < p.quantidade; i++) {
      unidades.push({
        pedidoId: p.pedidoId,
        clienteId: p.clienteId,
        clienteNome: p.clienteNome,
        tipoPaleteId: p.tipoPaleteId,
        tipoPaleteNome: p.tipoPaleteNome,
        comprimentoMm: p.comprimentoMm,
        larguraMm: p.larguraMm,
        ordem: p.ordem,
        orientacao: p.orientacao,
      });
    }
  }
  return unidades;
}

/**
 * Quantas paletes adicionais de um tipo ainda cabem nas caixas, depois de já
 * colocadas as `unidadesExistentes`. Implementado reaproveitando `empacotar`
 * diretamente: acrescenta `max` unidades sintéticas (pedidoId = -1) no fim da
 * lista e conta quantas foram colocadas — correto porque o algoritmo é
 * determinístico e nunca "reflui" paletes já colocadas (estabilidade), logo
 * anexar simplesmente continua o mesmo estado final. `max` é só um limite de
 * segurança contra dimensões degeneradas.
 */
export function estimarQuantosCabem(
  caixas: CaixaInput[],
  unidadesExistentes: PaleteUnidade[],
  tipoPalete: { tipoPaleteId: number; tipoPaleteNome: string; comprimentoMm: number; larguraMm: number },
  max = 150,
): number {
  const ordemBase = unidadesExistentes.reduce((m, u) => Math.max(m, u.ordem), 0);
  const sinteticas: PaleteUnidade[] = Array.from({ length: max }, (_, i) => ({
    pedidoId: -1,
    clienteId: -1,
    clienteNome: "",
    tipoPaleteId: tipoPalete.tipoPaleteId,
    tipoPaleteNome: tipoPalete.tipoPaleteNome,
    comprimentoMm: tipoPalete.comprimentoMm,
    larguraMm: tipoPalete.larguraMm,
    ordem: ordemBase + i + 1,
  }));

  const resultado = empacotar(caixas, [...unidadesExistentes, ...sinteticas]);
  return resultado.colocados.filter((c) => c.pedidoId === -1).length;
}

// ---------------------------------------------------------------------------
// Otimização da ordem de carga
// ---------------------------------------------------------------------------
//
// `empacotar` é sensível à ordem (as unidades são colocadas por `ordem` e nunca
// refluídas): a mesma lista de paletes numa ordem diferente pode caber toda ou
// deixar paletes de fora. `otimizarOrdem` procura a melhor ordem SEM tocar no
// motor — mantém
// cada cliente num bloco contíguo (as suas paletes ficam juntas no camião, para
// carga/descarga) e experimenta as ordens possíveis dos blocos.

interface PontuacaoPacking {
  naoColocados: number;
  caixasUsadas: number;
  comprimentoTotalMm: number;
}

/** Pontua um resultado de empacotamento — menor é melhor, comparado por
 * `compararPontuacao` (lexicográfico: cabe tudo > menos caixas > carga mais curta). */
export function pontuarPacking(r: ResultadoPacking): PontuacaoPacking {
  return {
    naoColocados: r.naoColocados.length,
    caixasUsadas: r.caixas.filter((c) => c.comprimentoUsadoMm > 0).length,
    comprimentoTotalMm: r.caixas.reduce((s, c) => s + c.comprimentoUsadoMm, 0),
  };
}

function compararPontuacao(a: PontuacaoPacking, b: PontuacaoPacking): number {
  if (a.naoColocados !== b.naoColocados) return a.naoColocados - b.naoColocados;
  if (a.caixasUsadas !== b.caixasUsadas) return a.caixasUsadas - b.caixasUsadas;
  return a.comprimentoTotalMm - b.comprimentoTotalMm;
}

function permutacoes<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const resto = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutacoes(resto)) out.push([arr[i], ...p]);
  }
  return out;
}

const areaPedido = (p: PedidoParaExpandir) => p.comprimentoMm * p.larguraMm;
const somaAreaBloco = (b: PedidoParaExpandir[]) =>
  b.reduce((s, p) => s + areaPedido(p) * p.quantidade, 0);
const maiorLadoBloco = (b: PedidoParaExpandir[]) =>
  Math.max(...b.map((p) => Math.max(p.comprimentoMm, p.larguraMm)));
const totalPaletesBloco = (b: PedidoParaExpandir[]) => b.reduce((s, p) => s + p.quantidade, 0);

/** Nº de clientes distintos acima do qual se deixa de testar todas as
 * permutações (n! cresce depressa) e se usa só um punhado de heurísticas. */
const MAX_CLIENTES_FORCA_BRUTA = 6;

/**
 * Procura a ordem de carga que melhor aproveita o espaço. Cada cliente é um
 * bloco contíguo; dentro do bloco as linhas de pedido são ordenadas por área
 * decrescente (First-Fit Decreasing). Devolve os `pedidoId` na ordem escolhida
 * e o empacotamento correspondente. Em empate de pontuação, mantém a ordem
 * atual (o 1º candidato testado), para `jaOtima` poder ser detetado por
 * comparação direta da lista de ids.
 */
export function otimizarOrdem(
  caixas: CaixaInput[],
  pedidos: PedidoParaExpandir[],
): { pedidoIdsOrdenados: number[]; packing: ResultadoPacking } {
  const ordemAtual = [...pedidos].sort((a, b) => a.ordem - b.ordem);

  if (ordemAtual.length <= 1 || caixas.length === 0) {
    return {
      pedidoIdsOrdenados: ordemAtual.map((p) => p.pedidoId),
      packing: empacotar(caixas, expandirNaOrdem(ordemAtual)),
    };
  }

  // Blocos de cliente, na ordem de 1ª aparição.
  const blocosMap = new Map<number, PedidoParaExpandir[]>();
  for (const p of ordemAtual) {
    const b = blocosMap.get(p.clienteId);
    if (b) b.push(p);
    else blocosMap.set(p.clienteId, [p]);
  }
  // Dentro de cada bloco: linhas maiores primeiro.
  const blocosFFD = [...blocosMap.values()].map((b) =>
    [...b].sort((x, y) => areaPedido(y) - areaPedido(x)),
  );

  let ordensBlocos: PedidoParaExpandir[][][];
  if (blocosFFD.length <= MAX_CLIENTES_FORCA_BRUTA) {
    ordensBlocos = permutacoes(blocosFFD);
  } else {
    ordensBlocos = [
      blocosFFD,
      [...blocosFFD].sort((a, b) => somaAreaBloco(b) - somaAreaBloco(a)),
      [...blocosFFD].sort((a, b) => maiorLadoBloco(b) - maiorLadoBloco(a)),
      [...blocosFFD].sort((a, b) => totalPaletesBloco(b) - totalPaletesBloco(a)),
    ];
  }

  // 1º candidato: exatamente a ordem atual (sem reordenar blocos nem linhas).
  const candidatos: PedidoParaExpandir[][] = [ordemAtual, ...ordensBlocos.map((o) => o.flat())];

  let melhor: { pedidos: PedidoParaExpandir[]; packing: ResultadoPacking; score: PontuacaoPacking } | null =
    null;
  for (const cand of candidatos) {
    const packing = empacotar(caixas, expandirNaOrdem(cand));
    const score = pontuarPacking(packing);
    if (!melhor || compararPontuacao(score, melhor.score) < 0) {
      melhor = { pedidos: cand, packing, score };
    }
  }

  return {
    pedidoIdsOrdenados: melhor!.pedidos.map((p) => p.pedidoId),
    packing: melhor!.packing,
  };
}
