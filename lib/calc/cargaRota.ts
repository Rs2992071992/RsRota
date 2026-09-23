// Verifica se as paletes de uma rota inteira cabem no veículo (+ reboque),
// usando o motor de empacotamento 2D real (o mesmo das Cargas do escritório).
// Puro — sem DB/framework. Usado ao vivo no registo do motorista e na página
// da rota do escritório.
//
// Conta o PIOR CASO: soma todas as paletes registadas na rota (o camião
// sai/acaba cheio). Meias-paletes não entram — não ocupam base própria.

import {
  empacotar,
  expandirPedidosEmUnidades,
  type CaixaInput,
  type ResultadoPacking,
} from "@/lib/calc/paletePacking";

export interface LinhaCarga {
  tipoPaleteId: number;
  comprimentoMm: number;
  larguraMm: number;
  nPaletes: number;
  clienteNome?: string;
}

/** Dimensões (mm) dos tipos de palete legados — `Paragem.tipoPalete` era uma
 * string ("PALETE_120X80"/"100") antes da migração para o catálogo TipoPalete
 * (2026-08-28). O nome diz o tamanho: 120×80cm e 120×100cm. */
export const DIMENSOES_PALETE_LEGADO: Record<string, { comprimentoMm: number; larguraMm: number }> = {
  PALETE_120X80: { comprimentoMm: 1200, larguraMm: 800 },
  PALETE_120X100: { comprimentoMm: 1200, larguraMm: 1000 },
};

/** Dimensões efetivas de uma paragem: as congeladas (estilo novo) ou o mapa
 * legado da string `tipoPalete`. `null` = não dá para saber (paragem por peso). */
export function dimensoesPaleteParagem(p: {
  paleteComprimentoMm: number | null;
  paleteLarguraMm: number | null;
  tipoPalete: string | null;
}): { comprimentoMm: number; larguraMm: number } | null {
  if (p.paleteComprimentoMm && p.paleteLarguraMm) {
    return { comprimentoMm: p.paleteComprimentoMm, larguraMm: p.paleteLarguraMm };
  }
  return (p.tipoPalete && DIMENSOES_PALETE_LEGADO[p.tipoPalete]) || null;
}

/** Linha de palete guardada em `Paragem.paletes` (Json) — ver `PaleteLinha`. */
export interface PaleteLinhaParagem {
  tipoPaleteId: number | null;
  comprimentoMm: number;
  larguraMm: number;
  nPaletes: number;
  sentido?: "ENTREGA" | "RECOLHA";
}

/** Linhas de palete de uma paragem, separadas por sentido. */
export interface LinhasCargaParagem {
  /** Descarregadas no cliente — vinham a bordo, saem aqui. */
  entregues: LinhaCarga[];
  /** Carregadas no cliente — entram aqui, ficam a bordo. */
  recolhidas: LinhaCarga[];
}

/**
 * Linhas de palete de uma paragem separadas por sentido (ENTREGA/RECOLHA): o
 * array `paletes` (vários tamanhos / sentidos na mesma paragem) ou, em fallback,
 * uma linha só a partir dos campos escalares / do mapa legado. Cada linha sem
 * `sentido` próprio segue o da paragem (`recolha` -> RECOLHA, senão ENTREGA).
 *
 * Meias-paletes: as que cabem em cima das paletes de base (≤ Σ bases) não
 * ocupam chão; as que sobram vão para o chão a **2 por lugar** (ceil), como uma
 * linha extra da mesma dimensão, no lado das entregas (ou recolhas, se a
 * paragem só recolher). Uma paragem só de meias (0 bases) conta na mesma.
 */
export function linhasCargaParagem(p: {
  paletes?: unknown;
  paleteComprimentoMm: number | null;
  paleteLarguraMm: number | null;
  tipoPalete: string | null;
  tipoPaleteId?: number | null;
  nPaletes: number;
  nMeiasPaletes?: number;
  recolha?: boolean;
  cliente?: string;
}): LinhasCargaParagem {
  const arr = Array.isArray(p.paletes) ? (p.paletes as PaleteLinhaParagem[]) : null;
  const sentidoParagem: "ENTREGA" | "RECOLHA" = p.recolha ? "RECOLHA" : "ENTREGA";
  const entregues: LinhaCarga[] = [];
  const recolhidas: LinhaCarga[] = [];
  let dimRef: { comprimentoMm: number; larguraMm: number; tipoPaleteId: number } | null = null;

  if (arr && arr.length > 0) {
    for (const l of arr) {
      if (!l || !(l.comprimentoMm > 0) || !(l.larguraMm > 0) || !(l.nPaletes > 0)) continue;
      const linha: LinhaCarga = {
        tipoPaleteId: l.tipoPaleteId ?? 0,
        comprimentoMm: l.comprimentoMm,
        larguraMm: l.larguraMm,
        nPaletes: l.nPaletes,
        clienteNome: p.cliente,
      };
      ((l.sentido ?? sentidoParagem) === "RECOLHA" ? recolhidas : entregues).push(linha);
      if (!dimRef) dimRef = { comprimentoMm: l.comprimentoMm, larguraMm: l.larguraMm, tipoPaleteId: l.tipoPaleteId ?? 0 };
    }
  } else {
    const dims = dimensoesPaleteParagem(p);
    if (dims) {
      dimRef = { comprimentoMm: dims.comprimentoMm, larguraMm: dims.larguraMm, tipoPaleteId: p.tipoPaleteId ?? 0 };
      if (p.nPaletes > 0) {
        (sentidoParagem === "RECOLHA" ? recolhidas : entregues).push({ ...dimRef, nPaletes: p.nPaletes, clienteNome: p.cliente });
      }
    }
  }

  const meias = Math.floor(p.nMeiasPaletes ?? 0);
  if (meias > 0 && dimRef) {
    const alvo = sentidoParagem === "RECOLHA" ? recolhidas : entregues;
    const totalBases = [...entregues, ...recolhidas].reduce((s, l) => s + l.nPaletes, 0);
    const noChao = Math.max(0, meias - totalBases);
    const slots = Math.ceil(noChao / 2);
    if (slots > 0) alvo.push({ ...dimRef, nPaletes: slots, clienteNome: p.cliente });
  }

  return { entregues, recolhidas };
}

export interface EspacoCarga {
  totalPaletes: number;
  colocadas: number;
  semEspaco: number;
  cabemTodas: boolean;
  /** false quando não há caixa configurada — não dá para verificar. */
  verificavel: boolean;
}

/** Uma paragem da rota, para a simulação de ocupação de espaço. */
export interface ParagemCarga {
  /** Descarregadas aqui — vinham a bordo desde o início do segmento. */
  entregues: LinhaCarga[];
  /** Carregadas aqui — ficam a bordo até ao fim do segmento. */
  recolhidas: LinhaCarga[];
  /** "VAZIO" corta a rota em segmentos — o camião esvaziou ali. */
  tipoVeiculo: string;
  /** Ordenação: sequência física real (mesmo critério de `pesosEmTransito`). */
  kmInicial: number;
  /**
   * Cliente desta paragem e, se for uma recolha para entregar a outro
   * cliente, o nome desse cliente — ver `faturarCliente`. Opcionais: sem
   * eles, esta paragem nunca entra numa "linha" (comportamento inalterado).
   */
  cliente?: string;
  faturarCliente?: string | null;
  /** Ida/Volta — opcional, só usado por `gerarPlantaCargaPorTroco` para
   * separar o pior momento de cada troço; sem isto, essa função devolve tudo
   * a `null` (comportamento das outras funções desta ficheiro inalterado). */
  tipoViagem?: string;
}

/** Um "momento" da rota já arrumado: contagens (`EspacoCarga`) + a geometria
 * real (`packing`, `null` só quando não há nada a bordo nesse momento). */
interface EstadoArrumado {
  espaco: EspacoCarga;
  packing: ResultadoPacking | null;
}

/** Arruma um conjunto de linhas (um "momento" da rota) e devolve o resultado —
 * contagens e a geometria (para desenhar a planta desse momento, se for o pior).
 *
 * As linhas são arrumadas pela ordem INVERSA das paragens — a última paragem a
 * entregar fica encostada à frente do camião (fundo da caixa, y=0) e a
 * primeira fica junto às portas. É a ordem física real de carga (carrega-se ao
 * contrário da descarga: quem sai primeiro entra por último, à mão nas portas).
 * `verificarEspacoCarga` e as plantas partilham esta mesma ordem, para o aviso
 * "cabem X de Y" e o desenho nunca se contradizerem. */
function empacotarEstado(caixas: CaixaInput[], linhas: LinhaCarga[]): EstadoArrumado {
  const validas = linhas
    .filter((l) => l.nPaletes > 0 && l.comprimentoMm > 0 && l.larguraMm > 0)
    .reverse();
  const totalPaletes = validas.reduce((s, l) => s + Math.floor(l.nPaletes), 0);
  if (totalPaletes === 0) {
    return {
      espaco: { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true },
      packing: null,
    };
  }
  const pedidos = validas.map((l, i) => ({
    pedidoId: i + 1,
    clienteId: i + 1,
    clienteNome: l.clienteNome ?? "",
    tipoPaleteId: l.tipoPaleteId,
    tipoPaleteNome: "",
    comprimentoMm: l.comprimentoMm,
    larguraMm: l.larguraMm,
    ordem: i + 1,
    quantidade: Math.floor(l.nPaletes),
  }));
  const r = empacotar(caixas, expandirPedidosEmUnidades(pedidos));
  return {
    espaco: {
      totalPaletes,
      colocadas: r.colocados.length,
      semEspaco: r.naoColocados.length,
      cabemTodas: r.naoColocados.length === 0,
      verificavel: true,
    },
    packing: r,
  };
}

const pior = (a: EstadoArrumado, b: EstadoArrumado): EstadoArrumado =>
  b.espaco.semEspaco > a.espaco.semEspaco ||
  (b.espaco.semEspaco === a.espaco.semEspaco && b.espaco.totalPaletes > a.espaco.totalPaletes)
    ? b
    : a;

/**
 * Caixas aplicáveis no corte `j` (ver `estadosDaRota`): `caixasBase` está
 * sempre presente; `caixaReboque` só entra quando a paragem desse corte
 * (mesmo critério de indexação de `piorDoTroco` abaixo, `ordenadas[Math.min(j,
 * n-1)]`) tem `tipoVeiculo === "CAMIAO+REBOQUE"` — reboque largado a meio da
 * rota (ex. descarrega e deixa o reboque no 1º cliente, segue só de camião)
 * deixa de estar disponível a partir do corte seguinte, mesmo sem nenhum
 * `VAZIO` a separar (2026-09-23, rota real RIC-Tec-A25).
 */
function caixasNoCorte(
  caixasBase: CaixaInput[],
  caixaReboque: CaixaInput | null,
  ordenadas: ReturnType<typeof filtrarLinhasValidas>,
  j: number,
): CaixaInput[] {
  const n = ordenadas.length;
  const comReboque = caixaReboque && ordenadas[Math.min(j, n - 1)]?.tipoVeiculo === "CAMIAO+REBOQUE";
  return comReboque ? [...caixasBase, caixaReboque] : caixasBase;
}

/**
 * Verifica se as paletes cabem no veículo (+ reboque, quando atrelado) SIMULANDO
 * a ocupação ao longo da rota — não a soma de tudo. Cada entrega vem a bordo
 * desde o início do segmento e sai na sua paragem; cada recolha entra na sua
 * paragem e fica até ao fim do segmento. Um trajeto `VAZIO` corta a rota em
 * segmentos que nunca coexistem (mesma lógica de `pesosEmTransito`).
 *
 * `caixaReboque` só se aplica aos momentos cuja paragem é CAMIAO+REBOQUE — ver
 * `caixasNoCorte`. `caixasBase` é o que está sempre presente (tipicamente só o
 * veículo).
 *
 * EXCEÇÃO (2026-09-04): uma recolha para entregar a outro cliente
 * (`faturarCliente` preenchido, ex. recolhida na Ida e só entregue na Volta)
 * não fica presa ao segmento onde foi apanhada — fica a bordo desde essa
 * recolha até à paragem cujo `cliente` é o alvo, **atravessando VAZIOs e a
 * fronteira Ida/Volta sem nunca ser considerada "perdida"**. Sem isto, o
 * motor contava-a a dobra: uma vez como "recolha, fica até ao fim do
 * segmento" e outra vez, incorretamente, como "entrega, estava a bordo desde
 * o início do segmento" (mesmo antes de ter sido recolhida). Mesma regra de
 * ligação recolha->entrega já usada para o peso em
 * `lib/calc/perRoute.ts::pesosEmTransito` — mas aqui `cliente`/
 * `faturarCliente` são opcionais: sem eles esta paragem nunca entra numa
 * "linha" e o cálculo é idêntico ao de sempre.
 *
 * Devolve o **pior momento** (mais paletes sem espaço); `totalPaletes` =
 * paletes a bordo nesse momento.
 *
 * A arrumação de cada momento segue a ordem INVERSA das paragens (ver
 * `empacotarEstado`) — a ordem física de carga. Partilhada com as plantas para
 * o aviso e o desenho baterem certo.
 */
export function verificarEspacoCarga(
  caixasBase: CaixaInput[],
  caixaReboque: CaixaInput | null,
  paragens: ParagemCarga[],
): EspacoCarga {
  const comLinhas = filtrarLinhasValidas(paragens);
  const totalGeral = totalDeLinhas(comLinhas);

  if (caixasBase.length === 0 && !caixaReboque) {
    return { totalPaletes: totalGeral, colocadas: totalGeral, semEspaco: 0, cabemTodas: true, verificavel: false };
  }
  if (totalGeral === 0) {
    return { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
  }

  const { estados, ordenadas } = estadosDaRota(comLinhas);
  let resultado: EstadoArrumado | null = null;
  for (let j = 0; j < estados.length; j++) {
    const estado = empacotarEstado(caixasNoCorte(caixasBase, caixaReboque, ordenadas, j), estados[j]);
    resultado = resultado ? pior(resultado, estado) : estado;
  }
  return resultado?.espaco ?? { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
}

/**
 * Planta de carga de uma rota inteira: gera a geometria (para desenhar, com o
 * mesmo componente das Cargas do escritório) do **pior momento** da rota —
 * mesma simulação/definição de "pior" que `verificarEspacoCarga`, mas devolve
 * o packing em vez de só as contagens. `null` se não há caixa configurada ou
 * não há nada a bordo em rota nenhuma (nada para desenhar).
 *
 * A geometria é arrumada pela ordem INVERSA das paragens (ver
 * `empacotarEstado`): a última entrega encostada à frente do camião (esquerda
 * no desenho, junto à cabine), a primeira junto às portas — a ordem real de
 * carga.
 */
export function gerarPlantaCargaRota(
  caixasBase: CaixaInput[],
  caixaReboque: CaixaInput | null,
  paragens: ParagemCarga[],
): ResultadoPacking | null {
  if (caixasBase.length === 0 && !caixaReboque) return null;
  const comLinhas = filtrarLinhasValidas(paragens);
  if (totalDeLinhas(comLinhas) === 0) return null;

  const { estados, ordenadas } = estadosDaRota(comLinhas);
  let resultado: EstadoArrumado | null = null;
  for (let j = 0; j < estados.length; j++) {
    const estado = empacotarEstado(caixasNoCorte(caixasBase, caixaReboque, ordenadas, j), estados[j]);
    resultado = resultado ? pior(resultado, estado) : estado;
  }
  return resultado?.packing ?? null;
}

export interface PlantaCargaPorTroco {
  ida: ResultadoPacking | null;
  volta: ResultadoPacking | null;
}

/**
 * Como `gerarPlantaCargaRota`, mas devolve o pior momento de CADA troço
 * (Ida/Volta) em separado, em vez do pior momento da rota inteira — útil
 * para mostrar 2 plantas (uma por sentido) na página da rota. Cada estado
 * (corte `j` de `estadosDaRota`) é atribuído ao troço da paragem em que
 * ocorre (mesmo critério do corte por VAZIO, `segmentoDe` acima: usa a
 * paragem em `Math.min(j, n-1)`). Uma recolha na Ida entregue na Volta
 * (`faturarCliente`) continua a atravessar a fronteira sem se perder — herda
 * o mesmo tratamento de `estadosDaRota` — por isso pode aparecer a bordo em
 * momentos de ambos os troços, o que é o comportamento correto (fisicamente
 * esteve a bordo nos dois).
 *
 * `tipoViagem` em falta nalgumas/todas as paragens (chamador não o preenche,
 * ex. simulação ao vivo do registo) devolve simplesmente `{ ida: null, volta:
 * null }` — nunca um erro.
 */
export function gerarPlantaCargaPorTroco(
  caixasBase: CaixaInput[],
  caixaReboque: CaixaInput | null,
  paragens: ParagemCarga[],
): PlantaCargaPorTroco {
  if (caixasBase.length === 0 && !caixaReboque) return { ida: null, volta: null };
  const comLinhas = filtrarLinhasValidas(paragens);
  if (totalDeLinhas(comLinhas) === 0) return { ida: null, volta: null };

  const { estados, ordenadas } = estadosDaRota(comLinhas);
  const n = ordenadas.length;
  const piorDoTroco = (alvo: "Ida" | "Volta"): ResultadoPacking | null => {
    let resultado: EstadoArrumado | null = null;
    for (let j = 0; j < estados.length; j++) {
      if (ordenadas[Math.min(j, n - 1)]?.tipoViagem !== alvo) continue;
      const estado = empacotarEstado(caixasNoCorte(caixasBase, caixaReboque, ordenadas, j), estados[j]);
      resultado = resultado ? pior(resultado, estado) : estado;
    }
    return resultado?.packing ?? null;
  };
  return { ida: piorDoTroco("Ida"), volta: piorDoTroco("Volta") };
}

function filtrarLinhasValidas(paragens: ParagemCarga[]) {
  const valida = (l: LinhaCarga) => l.nPaletes > 0 && l.comprimentoMm > 0 && l.larguraMm > 0;
  return paragens.map((p) => ({
    ...p,
    entregues: p.entregues.filter(valida),
    recolhidas: p.recolhidas.filter(valida),
  }));
}

function totalDeLinhas(comLinhas: ReturnType<typeof filtrarLinhasValidas>): number {
  const conta = (ls: LinhaCarga[]) => ls.reduce((a, l) => a + Math.floor(l.nPaletes), 0);
  return comLinhas.reduce((s, p) => s + conta(p.entregues) + conta(p.recolhidas), 0);
}

/** Todos os "momentos" (cortes) da rota, cada um com as linhas a bordo nesse
 * instante — a parte de `verificarEspacoCarga` independente das caixas
 * (reutilizada também por `gerarPlantaCargaRota`/`gerarPlantaCargaPorTroco`).
 * Devolve também `ordenadas` (paragens na sequência física usada para os
 * cortes) — só `gerarPlantaCargaPorTroco` precisa dela, para saber a que
 * troço (tipoViagem) pertence cada corte. */
function estadosDaRota(
  comLinhas: ReturnType<typeof filtrarLinhasValidas>,
): { estados: LinhaCarga[][]; ordenadas: ReturnType<typeof filtrarLinhasValidas> } {
  // Ordena pela sequência física.
  const ordenadas = [...comLinhas].sort((a, b) => a.kmInicial - b.kmInicial);
  const n = ordenadas.length;

  // Linhas recolha->entrega (ver comentário acima). Passo 1: recolhas cujo
  // alvo tem também uma entrega nesta rota. O alvo é `faturarCliente` (recolha
  // faturada a outro cliente) OU, numa recolha PURA (sem entrega própria), o
  // seu próprio `cliente` — recolher e mais tarde entregar as mesmas paletes
  // ao/no mesmo cliente (reposicionamento; ex. RIC-Tec-A24: recolhe 22 em
  // Ges-thc, entrega essas 22 no fim) é o mesmo lote físico, não pode contar a
  // dobra na ocupação. Uma MISTA (descarrega E recolhe) nunca liga pelo
  // próprio cliente — a sua entrega não tem nada a ver com a sua recolha.
  // Passo 2: a(s) entrega(s) desse alvo.
  const alvoRecolha = (p: {
    faturarCliente?: string | null;
    cliente?: string;
    entregues: LinhaCarga[];
  }) => p.faturarCliente?.trim() || (p.entregues.length === 0 ? p.cliente?.trim() : undefined);
  const clientesComEntrega = new Set(
    ordenadas
      .filter((p) => p.entregues.length > 0)
      .map((p) => p.cliente?.trim())
      .filter((x): x is string => !!x),
  );
  // Origem (a recolha que entra na linha) e destino (a entrega que a fecha)
  // guardados em conjuntos SEPARADOS — nunca um só `numaLinha` — porque uma
  // paragem MISTA pode ser a origem de uma linha e continuar a ter a sua
  // PRÓPRIA entrega, sem nada a ver com essa recolha (ex. RIC-Percam:
  // Tec-Percam descarrega 22 localmente E recolhe 22 para o Tecfil — as 22
  // locais não podem desaparecer só porque a recolha entrou numa linha).
  const origensLinha = new Set<number>();
  const destinosLinha = new Set<number>();
  const alvos = new Set<string>();
  ordenadas.forEach((p, i) => {
    const alvo = alvoRecolha(p);
    if (alvo && p.recolhidas.length > 0 && clientesComEntrega.has(alvo)) {
      origensLinha.add(i);
      alvos.add(alvo);
    }
  });
  // Índice da 1ª entrega de cada alvo — fecha a linha (todas as recolhas
  // desse alvo, mesmo várias, ficam a bordo até essa entrega). Uma 2ª entrega
  // para o mesmo alvo, se existir, NÃO entra na linha — fica no "resto" como
  // uma entrega normal (limitação assumida: só a 1ª entrega fecha a linha).
  const entregaIndicePorAlvo = new Map<string, number>();
  ordenadas.forEach((p, i) => {
    if (origensLinha.has(i)) return;
    const nome = p.cliente?.trim();
    if (nome && p.entregues.length > 0 && alvos.has(nome) && !entregaIndicePorAlvo.has(nome)) {
      destinosLinha.add(i);
      entregaIndicePorAlvo.set(nome, i);
    }
  });

  // Segmentos do "resto" (paragens fora de qualquer linha), cortados em
  // VAZIO — exatamente o modelo de sempre.
  let segId = 0;
  const segmentoDe = ordenadas.map((p) => {
    if (p.tipoVeiculo === "VAZIO") segId++;
    return segId;
  });

  const estados: LinhaCarga[][] = [];
  // Corte j (j = 0..n): estado "mesmo antes de processar a paragem de
  // índice j" — mesma semântica de sempre (entregues em i>=j ainda a bordo,
  // recolhidas em i<j já apanhadas), agora com 2 fontes combinadas:
  for (let j = 0; j <= n; j++) {
    const segCorte = segmentoDe[Math.min(j, n - 1)];
    const aBordo: LinhaCarga[] = [];

    // 1) Resto: dentro do MESMO segmento (VAZIO) do corte. As entregues contam
    // sempre, EXCETO nas paragens que fecham uma linha (`destinosLinha`) — essa
    // entrega É o lote da linha a ser entregue, já contado pelo passo 2 até
    // aqui, não pode voltar a contar como "entrega normal". As recolhidas
    // contam sempre, EXCETO nas que abrem uma linha (`origensLinha`) — essas
    // vivem só no passo 2. Sem esta separação por PAPEL (não por paragem
    // inteira), uma paragem MISTA que é origem de linha perdia a sua própria
    // entrega (lote distinto, nada a ver com a recolha) — ver RIC-Percam.
    ordenadas.forEach((p, i) => {
      if (segmentoDe[i] !== segCorte) return;
      if (i >= j && !destinosLinha.has(i)) aBordo.push(...p.entregues);
      if (i < j && !origensLinha.has(i)) aBordo.push(...p.recolhidas);
    });

    // 2) Linhas: recolhas já apanhadas (i<j) cujo alvo ainda não foi entregue
    // (a entrega, se existir, tem índice >= j) — atravessa segmentos/VAZIO.
    ordenadas.forEach((p, i) => {
      if (!origensLinha.has(i) || p.recolhidas.length === 0 || i >= j) return;
      const idxEntrega = entregaIndicePorAlvo.get(alvoRecolha(p)!);
      if (idxEntrega == null || j <= idxEntrega) aBordo.push(...p.recolhidas);
    });

    estados.push(aBordo);
  }

  return { estados, ordenadas };
}
