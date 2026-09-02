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

// Atalho para construir uma paragem da simulação.
function par(over: Partial<ParagemCarga> & { nPaletes?: number }): ParagemCarga {
  const { nPaletes, ...rest } = over;
  return {
    linhas: nPaletes != null ? [{ ...P1300, nPaletes, clienteNome: rest.recolha ? "R" : "E" }] : [],
    recolha: false,
    tipoVeiculo: "CAMIAO",
    kmInicial: 0,
    ...rest,
  };
}

describe("verificarEspacoCarga — simulação da ocupação ao longo da rota", () => {
  it("entrega única que cabe → cabemTodas", () => {
    const r = verificarEspacoCarga([CAMIAO], [par({ nPaletes: 6, kmInicial: 0 })]);
    expect(r.cabemTodas).toBe(true);
    expect(r.verificavel).toBe(true);
    expect(r.totalPaletes).toBe(6);
  });

  it("entregas puras que não cabem → avisa (comportamento de sempre)", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        par({ nPaletes: 8, kmInicial: 0 }),
        par({ nPaletes: 8, kmInicial: 50 }),
      ],
    );
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(16); // as 16 estão a bordo desde o início
    expect(r.colocadas + r.semEspaco).toBe(16);
  });

  it("reboque anexado absorve o overflow de entregas", () => {
    const r = verificarEspacoCarga(
      [CAMIAO, REBOQUE],
      [par({ nPaletes: 8, kmInicial: 0 }), par({ nPaletes: 8, kmInicial: 50 })],
    );
    expect(r.cabemTodas).toBe(true);
  });

  it("entregar 10 (enche) e SÓ DEPOIS recolher 10 → pico 10, cabe", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        par({ nPaletes: 10, kmInicial: 0 }), // entrega
        par({ nPaletes: 10, kmInicial: 100, recolha: true }), // recolha
      ],
    );
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(10); // nunca houve 20 a bordo
  });

  it("entrega + recolha sobrepostas: o pico é um estado misto", () => {
    // ordem por km: entrega6@0, recolha6@50, entrega6@100
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        par({ nPaletes: 6, kmInicial: 0 }),
        par({ nPaletes: 6, kmInicial: 50, recolha: true }),
        par({ nPaletes: 6, kmInicial: 100 }),
      ],
    );
    // estado após a recolha: entrega6@100 (ainda a bordo) + recolha6@50 = 12
    // paletes a bordo ao mesmo tempo — mais do que cabem no camião.
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12); // pico misto, não a soma (18) nem 6
    expect(r.semEspaco).toBeGreaterThan(0);
  });

  it("VAZIO corta em segmentos que nunca coexistem", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        par({ nPaletes: 10, kmInicial: 0 }), // entrega
        par({ tipoVeiculo: "VAZIO", kmInicial: 50 }), // esvazia
        par({ nPaletes: 10, kmInicial: 100, recolha: true }), // recolha
      ],
    );
    expect(r.cabemTodas).toBe(true); // 10 num segmento, 10 no outro
  });

  it("segmento só de recolhas que não cabe → avisa", () => {
    const r = verificarEspacoCarga([CAMIAO], [par({ nPaletes: 12, kmInicial: 0, recolha: true })]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12);
  });

  it("sem caixas → não verificável, não avisa", () => {
    const r = verificarEspacoCarga([], [par({ nPaletes: 999, kmInicial: 0 })]);
    expect(r.verificavel).toBe(false);
    expect(r.cabemTodas).toBe(true);
  });

  it("rota sem paletes → verificável, cabe (nada)", () => {
    const r = verificarEspacoCarga([CAMIAO], [par({ nPaletes: 0, kmInicial: 0 })]);
    expect(r.verificavel).toBe(true);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(0);
  });

  it("tamanhos diferentes entre entrega e recolha", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        {
          linhas: [{ tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 }],
          recolha: false,
          tipoVeiculo: "CAMIAO",
          kmInicial: 0,
        },
        {
          linhas: [{ tipoPaleteId: 2, comprimentoMm: 1150, larguraMm: 1150, nPaletes: 3 }],
          recolha: true,
          tipoVeiculo: "CAMIAO",
          kmInicial: 100,
        },
      ],
    );
    expect(r.cabemTodas).toBe(true);
  });
});

describe("linhasCargaParagem", () => {
  it("mesma paragem com 2 tamanhos → 2 linhas de carga", () => {
    const linhas = linhasCargaParagem({
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
    expect(linhas).toHaveLength(2);
    expect(linhas.reduce((s, l) => s + l.nPaletes, 0)).toBe(6);
  });

  it("paragem de linha única (só escalares) → 1 linha de carga", () => {
    const linhas = linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes: 12,
      cliente: "Cli",
    });
    expect(linhas).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 12, clienteNome: "Cli" },
    ]);
  });
});
