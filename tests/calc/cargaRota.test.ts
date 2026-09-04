import { describe, it, expect } from "vitest";
import {
  verificarEspacoCarga,
  linhasCargaParagem,
  type LinhaCarga,
  type ParagemCarga,
} from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque", comprimentoMm: 8150, larguraMm: 2480 };
// 1300×1100: cabem 10 no camião sozinho, 12 no reboque.
const P1300: Omit<LinhaCarga, "nPaletes"> = { tipoPaleteId: 1, comprimentoMm: 1300, larguraMm: 1100 };

/** Atalho: paragem de entrega pura (tudo a bordo desde o início do segmento). */
function entrega(nPaletes: number, kmInicial: number, tipoVeiculo = "CAMIAO"): ParagemCarga {
  return {
    entregues: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: "E" }] : [],
    recolhidas: [],
    tipoVeiculo,
    kmInicial,
  };
}

/** Atalho: paragem de recolha pura (entra aqui, fica a bordo). */
function recolha(nPaletes: number, kmInicial: number): ParagemCarga {
  return {
    entregues: [],
    recolhidas: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: "R" }] : [],
    tipoVeiculo: "CAMIAO",
    kmInicial,
  };
}

/** Atalho: paragem mista (descarrega umas, carrega outras). */
function mista(nEntregues: number, nRecolhidas: number, kmInicial: number): ParagemCarga {
  return {
    entregues: nEntregues > 0 ? [{ ...P1300, nPaletes: nEntregues, clienteNome: "M" }] : [],
    recolhidas: nRecolhidas > 0 ? [{ ...P1300, nPaletes: nRecolhidas, clienteNome: "M" }] : [],
    tipoVeiculo: "CAMIAO",
    kmInicial,
  };
}

/** Atalho: troço VAZIO (fronteira de segmento). */
function vazio(kmInicial: number): ParagemCarga {
  return { entregues: [], recolhidas: [], tipoVeiculo: "VAZIO", kmInicial };
}

describe("verificarEspacoCarga — simulação da ocupação ao longo da rota", () => {
  it("entrega única que cabe → cabemTodas", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(6, 0)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.verificavel).toBe(true);
    expect(r.totalPaletes).toBe(6);
  });

  it("entregas puras que não cabem → avisa (comportamento de sempre)", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(8, 0), entrega(8, 50)]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(16); // as 16 estão a bordo desde o início
    expect(r.colocadas + r.semEspaco).toBe(16);
  });

  it("reboque anexado absorve o overflow de entregas", () => {
    const r = verificarEspacoCarga([CAMIAO, REBOQUE], [entrega(8, 0), entrega(8, 50)]);
    expect(r.cabemTodas).toBe(true);
  });

  it("entregar 10 (enche) e SÓ DEPOIS recolher 10 → pico 10, cabe", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(10, 0), recolha(10, 100)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(10); // nunca houve 20 a bordo
  });

  it("entrega + recolha sobrepostas: o pico é um estado misto", () => {
    // ordem por km: entrega6@0, recolha6@50, entrega6@100
    const r = verificarEspacoCarga([CAMIAO], [entrega(6, 0), recolha(6, 50), entrega(6, 100)]);
    // estado após a recolha: entrega6@100 (ainda a bordo) + recolha6@50 = 12
    // paletes a bordo ao mesmo tempo — mais do que cabem no camião.
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12); // pico misto, não a soma (18) nem 6
    expect(r.semEspaco).toBeGreaterThan(0);
  });

  it("VAZIO corta em segmentos que nunca coexistem", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(10, 0), vazio(50), recolha(10, 100)]);
    expect(r.cabemTodas).toBe(true); // 10 num segmento, 10 no outro
  });

  it("segmento só de recolhas que não cabe → avisa", () => {
    const r = verificarEspacoCarga([CAMIAO], [recolha(12, 0)]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12);
  });

  it("sem caixas → não verificável, não avisa", () => {
    const r = verificarEspacoCarga([], [entrega(999, 0)]);
    expect(r.verificavel).toBe(false);
    expect(r.cabemTodas).toBe(true);
  });

  it("rota sem paletes → verificável, cabe (nada)", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(0, 0)]);
    expect(r.verificavel).toBe(true);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(0);
  });

  it("tamanhos diferentes entre entrega e recolha", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        { entregues: [{ tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 }], recolhidas: [], tipoVeiculo: "CAMIAO", kmInicial: 0 },
        { entregues: [], recolhidas: [{ tipoPaleteId: 2, comprimentoMm: 1150, larguraMm: 1150, nPaletes: 3 }], tipoVeiculo: "CAMIAO", kmInicial: 100 },
      ],
    );
    expect(r.cabemTodas).toBe(true);
  });

  it("paragem mista: descarrega 6 + carrega 4 no mesmo stop → pico não é a soma", () => {
    // Antes de mais nada a bordo: 6 (entregues aqui). Depois: 4 (recolhidas aqui).
    const r = verificarEspacoCarga([CAMIAO], [mista(6, 4, 0)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(6); // pico = max(6, 4), nunca 10
  });

  it("paragem mista no meio de uma rota: pico é o estado antes/depois do sítio misto", () => {
    // entrega3@0, mista(descarrega 2, carrega 8)@50
    const r = verificarEspacoCarga([CAMIAO], [entrega(3, 0), mista(2, 8, 50)]);
    // Início do segmento: 3 (entrega0) + 2 (entregues da mista) = 5 a bordo.
    // Entre as 2 paragens: só os 2 da mista (a de 3 já saiu) = 2.
    // Fim: as 8 carregadas na mista ficam a bordo = 8. Pico = 8, nunca 3+2+8=13.
    expect(r.totalPaletes).toBe(8);
    expect(r.cabemTodas).toBe(true);
  });
});

describe("linhasCargaParagem", () => {
  it("mesma paragem com 2 tamanhos → 2 linhas de entregues", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 2 },
      ],
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      nPaletes: 6,
      cliente: "Cli",
    });
    expect(entregues).toHaveLength(2);
    expect(recolhidas).toHaveLength(0);
    expect(entregues.reduce((s, l) => s + l.nPaletes, 0)).toBe(6);
  });

  it("linhas com sentido RECOLHA vão para `recolhidas`", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4, sentido: "ENTREGA" },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 3, sentido: "RECOLHA" },
      ],
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      nPaletes: 7,
      recolha: true,
      cliente: "Cli",
    });
    expect(entregues.reduce((s, l) => s + l.nPaletes, 0)).toBe(4);
    expect(recolhidas.reduce((s, l) => s + l.nPaletes, 0)).toBe(3);
  });

  it("paragem de linha única (só escalares) → 1 linha em entregues", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes: 12,
      cliente: "Cli",
    });
    expect(recolhidas).toHaveLength(0);
    expect(entregues).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 12, clienteNome: "Cli" },
    ]);
  });

  it("paragem de linha única com `recolha: true` (sem sentido explícito) → vai para recolhidas", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes: 12,
      recolha: true,
      cliente: "Cli",
    });
    expect(entregues).toHaveLength(0);
    expect(recolhidas).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 12, clienteNome: "Cli" },
    ]);
  });

  const escalar = (nPaletes: number, nMeiasPaletes: number) =>
    linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes,
      nMeiasPaletes,
      cliente: "Cli",
    }).entregues;

  it("só 1 meia-palete (0 inteiras) → 1 lugar", () => {
    expect(escalar(0, 1).reduce((s, l) => s + l.nPaletes, 0)).toBe(1);
  });

  it("4 meias soltas → 2 lugares (2 por lugar)", () => {
    expect(escalar(0, 4).reduce((s, l) => s + l.nPaletes, 0)).toBe(2);
  });

  it("meias que cabem em cima das bases não ocupam chão", () => {
    expect(escalar(5, 3)).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 5, clienteNome: "Cli" },
    ]);
  });

  it("bases 5 + 9 meias → 5 + ceil((9-5)/2)=2 = linha extra de 2", () => {
    const r = escalar(5, 9);
    expect(r).toHaveLength(2);
    expect(r.reduce((s, l) => s + l.nPaletes, 0)).toBe(7);
  });
});
