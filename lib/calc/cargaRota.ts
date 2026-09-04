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
}

/** Arruma um conjunto de linhas (um "momento" da rota) e devolve o resultado. */
function empacotarEstado(caixas: CaixaInput[], linhas: LinhaCarga[]): EspacoCarga {
  const validas = linhas.filter((l) => l.nPaletes > 0 && l.comprimentoMm > 0 && l.larguraMm > 0);
  const totalPaletes = validas.reduce((s, l) => s + Math.floor(l.nPaletes), 0);
  if (totalPaletes === 0) {
    return { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
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
    totalPaletes,
    colocadas: r.colocados.length,
    semEspaco: r.naoColocados.length,
    cabemTodas: r.naoColocados.length === 0,
    verificavel: true,
  };
}

const pior = (a: EspacoCarga, b: EspacoCarga): EspacoCarga =>
  b.semEspaco > a.semEspaco || (b.semEspaco === a.semEspaco && b.totalPaletes > a.totalPaletes) ? b : a;

/**
 * Verifica se as paletes cabem no veículo (+ reboque) SIMULANDO a ocupação ao
 * longo da rota — não a soma de tudo. Cada entrega vem a bordo desde o início do
 * segmento e sai na sua paragem; cada recolha entra na sua paragem e fica até ao
 * fim do segmento. Um trajeto `VAZIO` corta a rota em segmentos que nunca
 * coexistem (mesma lógica de `pesosEmTransito`). Devolve o **pior momento**
 * (mais paletes sem espaço); `totalPaletes` = paletes a bordo nesse momento.
 */
export function verificarEspacoCarga(caixas: CaixaInput[], paragens: ParagemCarga[]): EspacoCarga {
  const valida = (l: LinhaCarga) => l.nPaletes > 0 && l.comprimentoMm > 0 && l.larguraMm > 0;
  const comLinhas = paragens.map((p) => ({
    ...p,
    entregues: p.entregues.filter(valida),
    recolhidas: p.recolhidas.filter(valida),
  }));
  const conta = (ls: LinhaCarga[]) => ls.reduce((a, l) => a + Math.floor(l.nPaletes), 0);
  const totalGeral = comLinhas.reduce((s, p) => s + conta(p.entregues) + conta(p.recolhidas), 0);

  if (caixas.length === 0) {
    return { totalPaletes: totalGeral, colocadas: totalGeral, semEspaco: 0, cabemTodas: true, verificavel: false };
  }
  if (totalGeral === 0) {
    return { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
  }

  // Ordena pela sequência física e corta em segmentos nos trajetos VAZIO.
  const ordenadas = [...comLinhas].sort((a, b) => a.kmInicial - b.kmInicial);
  const segmentos: (typeof ordenadas)[] = [];
  let atual: typeof ordenadas = [];
  for (const p of ordenadas) {
    if (p.tipoVeiculo === "VAZIO") {
      if (atual.length) segmentos.push(atual);
      atual = [];
      continue;
    }
    atual.push(p);
  }
  if (atual.length) segmentos.push(atual);

  let resultado: EspacoCarga | null = null;
  for (const seg of segmentos) {
    // Estado j (j = 0..n): entregas em índice >= j (ainda a bordo) +
    // recolhas em índice < j (já apanhadas). Uma paragem mista contribui com as
    // suas entregues enquanto i >= j e com as suas recolhidas quando i < j.
    for (let j = 0; j <= seg.length; j++) {
      const aBordo: LinhaCarga[] = [];
      seg.forEach((p, i) => {
        if (i >= j) aBordo.push(...p.entregues);
        if (i < j) aBordo.push(...p.recolhidas);
      });
      const estado = empacotarEstado(caixas, aBordo);
      resultado = resultado ? pior(resultado, estado) : estado;
    }
  }

  return resultado ?? { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
}
