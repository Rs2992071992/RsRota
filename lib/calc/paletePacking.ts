// Motor de empacotamento de paletes em caixas (veículo/reboque). Puro
// TypeScript, sem dependências de framework/DB (ver convenção em
// lib/calc/perStop.ts).
//
// Empacotamento "online", por ordem de chegada (`ordem`), NUNCA reordenado
// por tamanho: quem liga primeiro ocupa espaço primeiro, e a resposta de
// "quanto espaço resta" não pode mudar retroativamente quando chega um
// pedido novo maior. Cada palete é colocada por "prateleiras" (linhas): as
// paletes ficam lado a lado ao longo da largura da caixa até não caber mais
// nenhuma na prateleira aberta, altura em que se fecha e abre-se a
// seguinte ao longo do comprimento. Quando uma caixa fica cheia, passa-se
// para a caixa seguinte da lista (ex.: veículo -> reboque, se anexado).

export interface CaixaInput {
  /** Identifica a caixa (ex.: "veiculo" ou o id do reboque anexado). */
  id: string;
  label: string;
  /** Eixo ao longo do qual as prateleiras se empilham. */
  comprimentoMm: number;
  /** Eixo ao longo do qual as paletes ficam lado a lado numa prateleira. */
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
  prateleiraIndex: number;
  rotacionado: boolean;
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

export interface PrateleiraResultado {
  index: number;
  cursorInicioMm: number;
  profundidadeMm: number;
  larguraUsadaMm: number;
  itens: PaleteColocada[];
}

export interface CaixaResultado {
  caixa: CaixaInput;
  prateleiras: PrateleiraResultado[];
  areaUsadaMm2: number;
  areaTotalMm2: number;
  comprimentoUsadoMm: number;
}

export interface ResultadoPacking {
  caixas: CaixaResultado[];
  colocados: PaleteColocada[];
  naoColocados: PaleteNaoColocada[];
}

interface Orientacao {
  larguraOcupada: number;
  profundidadeOcupada: number;
  rotacionado: boolean;
}

function orientacoesQueCabem(caixa: CaixaInput, unidade: PaleteUnidade): Orientacao[] {
  const candidatas: Orientacao[] = [
    { larguraOcupada: unidade.larguraMm, profundidadeOcupada: unidade.comprimentoMm, rotacionado: false },
    { larguraOcupada: unidade.comprimentoMm, profundidadeOcupada: unidade.larguraMm, rotacionado: true },
  ];
  const forcada =
    unidade.orientacao === "COMPRIDO"
      ? candidatas.filter((o) => !o.rotacionado)
      : unidade.orientacao === "TRAVES"
        ? candidatas.filter((o) => o.rotacionado)
        : candidatas;
  return forcada.filter((o) => o.larguraOcupada <= caixa.larguraMm);
}

/**
 * Ordena orientações por preferência ao abrir uma prateleira nova: primeiro a
 * que encaixa mais paletes lado a lado (`largura da caixa / largura ocupada`,
 * arredondado por baixo) — testado contra o exemplo do próprio utilizador:
 * escolher sempre a orientação de menor profundidade dava só 6 das 10 paletes
 * 1300x1100 no camião (1 por prateleira), quando na realidade cabem 10 (2 por
 * prateleira, na orientação que ocupa menos largura). Em empate, a de menor
 * profundidade (deixa mais comprimento livre para prateleiras futuras).
 */
function compararPreferenciaNovaPrateleira(caixa: CaixaInput) {
  return (a: Orientacao, b: Orientacao): number => {
    const contA = Math.floor(caixa.larguraMm / a.larguraOcupada);
    const contB = Math.floor(caixa.larguraMm / b.larguraOcupada);
    if (contB !== contA) return contB - contA;
    return a.profundidadeOcupada - b.profundidadeOcupada;
  };
}

interface PrateleiraAberta {
  profundidadeMm: number;
  larguraUsadaMm: number;
  itens: PaleteColocada[];
}

interface EstadoCaixa {
  caixa: CaixaInput;
  cursorMm: number;
  prateleiraAberta: PrateleiraAberta | null;
  prateleirasFechadas: PrateleiraResultado[];
}

function fecharPrateleira(estado: EstadoCaixa): void {
  const pa = estado.prateleiraAberta;
  if (!pa) return;
  estado.prateleirasFechadas.push({
    index: estado.prateleirasFechadas.length,
    cursorInicioMm: estado.cursorMm,
    profundidadeMm: pa.profundidadeMm,
    larguraUsadaMm: pa.larguraUsadaMm,
    itens: pa.itens,
  });
  estado.cursorMm += pa.profundidadeMm;
  estado.prateleiraAberta = null;
}

/**
 * Tenta colocar uma unidade numa caixa: primeiro na prateleira aberta (só
 * aceita orientações com profundidade <= à já comprometida — uma prateleira
 * nunca "cresce" depois do 1º item, para manter a grelha visual retangular),
 * senão fecha-a e abre uma nova (orientação de menor profundidade, para
 * maximizar prateleiras futuras). Devolve null se a caixa não tem espaço.
 */
function tentarColocarNaCaixa(estado: EstadoCaixa, unidade: PaleteUnidade): PaleteColocada | null {
  const { caixa } = estado;
  const candidatas = orientacoesQueCabem(caixa, unidade);
  if (candidatas.length === 0) return null;

  if (estado.prateleiraAberta) {
    const pa = estado.prateleiraAberta;
    // Entre as orientações que cabem na prateleira aberta, prefere a de menor
    // largura ocupada — deixa mais espaço livre na prateleira para os
    // próximos itens (maximiza quantos entram nesta linha), em vez de
    // "gastar" logo o espaço com a orientação mais larga.
    const cabem = candidatas
      .filter((o) => o.profundidadeOcupada <= pa.profundidadeMm)
      .filter((o) => o.larguraOcupada <= caixa.larguraMm - pa.larguraUsadaMm)
      .sort((a, b) => a.larguraOcupada - b.larguraOcupada);

    if (cabem.length > 0) {
      const o = cabem[0];
      const colocada: PaleteColocada = {
        ...unidade,
        caixaId: caixa.id,
        prateleiraIndex: estado.prateleirasFechadas.length,
        rotacionado: o.rotacionado,
        x: pa.larguraUsadaMm,
        y: estado.cursorMm,
        larguraOcupada: o.larguraOcupada,
        comprimentoOcupado: o.profundidadeOcupada,
      };
      pa.larguraUsadaMm += o.larguraOcupada;
      pa.itens.push(colocada);
      return colocada;
    }

    fecharPrateleira(estado);
  }

  // Tenta a orientação preferida (mais paletes lado a lado); se não couber no
  // comprimento restante desta caixa, cai para a alternativa (ex.: perto do
  // fim da caixa só resta espaço para a orientação "de lado").
  const preferencia = [...candidatas].sort(compararPreferenciaNovaPrateleira(caixa));
  const escolhida = preferencia.find(
    (o) => estado.cursorMm + o.profundidadeOcupada <= caixa.comprimentoMm,
  );
  if (!escolhida) return null;

  const colocada: PaleteColocada = {
    ...unidade,
    caixaId: caixa.id,
    prateleiraIndex: estado.prateleirasFechadas.length,
    rotacionado: escolhida.rotacionado,
    x: 0,
    y: estado.cursorMm,
    larguraOcupada: escolhida.larguraOcupada,
    comprimentoOcupado: escolhida.profundidadeOcupada,
  };
  estado.prateleiraAberta = {
    profundidadeMm: escolhida.profundidadeOcupada,
    larguraUsadaMm: escolhida.larguraOcupada,
    itens: [colocada],
  };
  return colocada;
}

function colocarUnidade(
  estados: EstadoCaixa[],
  unidade: PaleteUnidade,
): { sucesso: true; colocada: PaleteColocada } | { sucesso: false; motivo: MotivoNaoColocado } {
  let aceitaAlgumaOrientacao = false;
  for (const estado of estados) {
    if (orientacoesQueCabem(estado.caixa, unidade).length > 0) {
      aceitaAlgumaOrientacao = true;
    }
    const colocada = tentarColocarNaCaixa(estado, unidade);
    if (colocada) return { sucesso: true, colocada };
  }
  return { sucesso: false, motivo: aceitaAlgumaOrientacao ? "SEM_ESPACO" : "NAO_CABE_ORIENTACAO" };
}

/**
 * Empacota as unidades nas caixas dadas, por ordem de chegada (`ordem`).
 * Caixas devem vir na ordem em que o overflow deve ser tentado (ex.: caixa
 * do veículo primeiro, depois a do reboque se anexado).
 */
export function empacotar(caixas: CaixaInput[], unidades: PaleteUnidade[]): ResultadoPacking {
  const estados: EstadoCaixa[] = caixas.map((caixa) => ({
    caixa,
    cursorMm: 0,
    prateleiraAberta: null,
    prateleirasFechadas: [],
  }));

  const colocados: PaleteColocada[] = [];
  const naoColocados: PaleteNaoColocada[] = [];
  const ordenadas = [...unidades].sort((a, b) => a.ordem - b.ordem);

  for (const unidade of ordenadas) {
    if (estados.length === 0) {
      naoColocados.push({ unidade, motivo: "SEM_ESPACO" });
      continue;
    }
    const resultado = colocarUnidade(estados, unidade);
    if (resultado.sucesso) {
      colocados.push(resultado.colocada);
    } else {
      naoColocados.push({ unidade, motivo: resultado.motivo });
    }
  }

  for (const estado of estados) fecharPrateleira(estado);

  const caixasResultado: CaixaResultado[] = estados.map((estado) => ({
    caixa: estado.caixa,
    prateleiras: estado.prateleirasFechadas,
    areaUsadaMm2: estado.prateleirasFechadas.reduce(
      (soma, p) => soma + p.itens.reduce((s, it) => s + it.larguraOcupada * it.comprimentoOcupado, 0),
      0,
    ),
    areaTotalMm2: estado.caixa.comprimentoMm * estado.caixa.larguraMm,
    comprimentoUsadoMm: estado.cursorMm,
  }));

  return { caixas: caixasResultado, colocados, naoColocados };
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
  max = 500,
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
// `empacotar` é sensível à ordem (empacotamento por prateleiras, "online"): a
// mesma lista de paletes numa ordem diferente pode caber toda ou deixar paletes
// de fora. `otimizarOrdem` procura a melhor ordem SEM tocar no motor — mantém
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
