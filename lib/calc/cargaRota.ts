// Verifica se as paletes de uma rota cabem no veículo (+ reboque), usando o
// motor de empacotamento 2D real (o mesmo das Cargas do escritório). Puro —
// sem DB/framework. Usado ao vivo no registo do motorista e na página da rota
// do escritório.
//
// Uma rota é dada em SEGMENTOS: um trajeto VAZIO esvazia o camião, por isso
// corta a carga em segmentos que nunca coexistem (mesma lógica de
// `pesosEmTransito` em perRoute.ts). Verifica cada segmento e devolve o PIOR
// (mais paletes sem espaço). Dentro de um segmento é o pior caso — soma tudo.
// Meias-paletes não entram — não ocupam base própria.

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

export interface EspacoCarga {
  totalPaletes: number;
  colocadas: number;
  semEspaco: number;
  cabemTodas: boolean;
  /** false quando não há caixa configurada — não dá para verificar. */
  verificavel: boolean;
}

function empacotarSegmento(caixas: CaixaInput[], linhas: LinhaCarga[]): EspacoCarga {
  const pedidos = linhas.map((l, i) => ({
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
  const total = pedidos.reduce((s, p) => s + p.quantidade, 0);
  const r = empacotar(caixas, expandirPedidosEmUnidades(pedidos));
  return {
    totalPaletes: total,
    colocadas: r.colocados.length,
    semEspaco: r.naoColocados.length,
    cabemTodas: r.naoColocados.length === 0,
    verificavel: true,
  };
}

/**
 * `segmentos` = a carga da rota partida nos trajetos VAZIO (cada segmento é o
 * conjunto de paletes que estão no camião ao mesmo tempo). Devolve o segmento
 * pior (mais paletes sem espaço).
 */
export function verificarEspacoCarga(caixas: CaixaInput[], segmentos: LinhaCarga[][]): EspacoCarga {
  const segs = segmentos
    .map((linhas) => linhas.filter((l) => l.nPaletes > 0 && l.comprimentoMm > 0 && l.larguraMm > 0))
    .filter((linhas) => linhas.length > 0);
  const totalGeral = segs.reduce(
    (s, linhas) => s + linhas.reduce((a, l) => a + Math.floor(l.nPaletes), 0),
    0,
  );

  if (caixas.length === 0) {
    return { totalPaletes: totalGeral, colocadas: totalGeral, semEspaco: 0, cabemTodas: true, verificavel: false };
  }
  if (segs.length === 0) {
    return { totalPaletes: 0, colocadas: 0, semEspaco: 0, cabemTodas: true, verificavel: true };
  }

  let pior: EspacoCarga | null = null;
  for (const linhas of segs) {
    const cand = empacotarSegmento(caixas, linhas);
    if (
      !pior ||
      cand.semEspaco > pior.semEspaco ||
      (cand.semEspaco === pior.semEspaco && cand.totalPaletes > pior.totalPaletes)
    ) {
      pior = cand;
    }
  }
  return pior!;
}
