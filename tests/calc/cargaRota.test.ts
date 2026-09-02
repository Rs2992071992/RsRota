import { describe, it, expect } from "vitest";
import { verificarEspacoCarga, linhasCargaParagem, type LinhaCarga } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque", comprimentoMm: 8150, larguraMm: 2480 };
const P1300: Omit<LinhaCarga, "nPaletes"> = { tipoPaleteId: 1, comprimentoMm: 1300, larguraMm: 1100 };

describe("verificarEspacoCarga", () => {
  it("cabe tudo → cabemTodas true", () => {
    const r = verificarEspacoCarga([CAMIAO], [{ ...P1300, nPaletes: 6 }]);
    expect(r.cabemTodas).toBe(true);
    expect(r.verificavel).toBe(true);
    expect(r.semEspaco).toBe(0);
    expect(r.totalPaletes).toBe(6);
  });

  it("soma várias linhas da rota; overflow → cabemTodas false", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        { ...P1300, nPaletes: 8, clienteNome: "A" },
        { ...P1300, nPaletes: 8, clienteNome: "B" },
      ],
    );
    expect(r.totalPaletes).toBe(16);
    expect(r.cabemTodas).toBe(false);
    expect(r.semEspaco).toBeGreaterThan(0);
    expect(r.colocadas + r.semEspaco).toBe(16);
  });

  it("reboque anexado absorve o overflow", () => {
    const r = verificarEspacoCarga(
      [CAMIAO, REBOQUE],
      [
        { ...P1300, nPaletes: 8, clienteNome: "A" },
        { ...P1300, nPaletes: 8, clienteNome: "B" },
      ],
    );
    expect(r.cabemTodas).toBe(true);
  });

  it("sem caixas → não verificável, não avisa", () => {
    const r = verificarEspacoCarga([], [{ ...P1300, nPaletes: 999 }]);
    expect(r.verificavel).toBe(false);
    expect(r.cabemTodas).toBe(true);
  });

  it("rota sem paletes → verificável, cabe (nada)", () => {
    const r = verificarEspacoCarga([CAMIAO], [{ ...P1300, nPaletes: 0 }]);
    expect(r.verificavel).toBe(true);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(0);
  });

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

  it("tipos de palete diferentes na mesma rota somam certo", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 },
        { tipoPaleteId: 2, comprimentoMm: 1150, larguraMm: 1150, nPaletes: 3 },
      ],
    );
    expect(r.totalPaletes).toBe(7);
    expect(r.cabemTodas).toBe(true);
  });
});
