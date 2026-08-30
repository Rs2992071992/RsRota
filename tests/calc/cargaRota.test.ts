import { describe, it, expect } from "vitest";
import { verificarEspacoCarga, dimensoesPaleteParagem, type LinhaCarga } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque", comprimentoMm: 8150, larguraMm: 2480 };
const P1300: Omit<LinhaCarga, "nPaletes"> = { tipoPaleteId: 1, comprimentoMm: 1300, larguraMm: 1100 };

describe("verificarEspacoCarga", () => {
  it("cabe tudo → cabemTodas true", () => {
    const r = verificarEspacoCarga([CAMIAO], [[{ ...P1300, nPaletes: 6 }]]);
    expect(r.cabemTodas).toBe(true);
    expect(r.verificavel).toBe(true);
    expect(r.semEspaco).toBe(0);
    expect(r.totalPaletes).toBe(6);
  });

  it("soma várias linhas do mesmo segmento; overflow → cabemTodas false", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [[{ ...P1300, nPaletes: 8, clienteNome: "A" }, { ...P1300, nPaletes: 8, clienteNome: "B" }]],
    );
    expect(r.totalPaletes).toBe(16);
    expect(r.cabemTodas).toBe(false);
    expect(r.semEspaco).toBeGreaterThan(0);
    expect(r.colocadas + r.semEspaco).toBe(16);
  });

  it("VAZIO corta em segmentos: 34 entregues + 20 recolhidos depois → verifica o pior segmento, não a soma", () => {
    // Segmento 1: 34 paletes 1200x800 (cabem no camião+reboque).
    // Segmento 2: 20 paletes 1300x1100 (cabem à vontade).
    const seg1: LinhaCarga[] = [{ tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 800, nPaletes: 34, clienteNome: "Plas-Sonae" }];
    const seg2: LinhaCarga[] = [{ ...P1300, nPaletes: 20, clienteNome: "Tecfil" }];
    const r = verificarEspacoCarga([CAMIAO, REBOQUE], [seg1, seg2]);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(34); // o pior segmento, não 54
  });

  it("um segmento que não cabe faz cabemTodas false mesmo que os outros caibam", () => {
    const seg1: LinhaCarga[] = [{ ...P1300, nPaletes: 30, clienteNome: "A" }]; // não cabe no camião só
    const seg2: LinhaCarga[] = [{ ...P1300, nPaletes: 2, clienteNome: "B" }];
    const r = verificarEspacoCarga([CAMIAO], [seg1, seg2]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(30);
  });

  it("reboque anexado absorve o overflow", () => {
    const r = verificarEspacoCarga(
      [CAMIAO, REBOQUE],
      [[{ ...P1300, nPaletes: 8, clienteNome: "A" }, { ...P1300, nPaletes: 8, clienteNome: "B" }]],
    );
    expect(r.cabemTodas).toBe(true);
  });

  it("sem caixas → não verificável, não avisa", () => {
    const r = verificarEspacoCarga([], [[{ ...P1300, nPaletes: 999 }]]);
    expect(r.verificavel).toBe(false);
    expect(r.cabemTodas).toBe(true);
  });

  it("rota sem paletes → verificável, cabe (nada)", () => {
    const r = verificarEspacoCarga([CAMIAO], [[{ ...P1300, nPaletes: 0 }]]);
    expect(r.verificavel).toBe(true);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(0);
  });
});

describe("dimensoesPaleteParagem", () => {
  it("usa as dimensões congeladas quando existem", () => {
    expect(
      dimensoesPaleteParagem({ paleteComprimentoMm: 1300, paleteLarguraMm: 1100, tipoPalete: null }),
    ).toEqual({ comprimentoMm: 1300, larguraMm: 1100 });
  });

  it("resolve o tipo legado PALETE_120X80 / PALETE_120X100", () => {
    expect(
      dimensoesPaleteParagem({ paleteComprimentoMm: null, paleteLarguraMm: null, tipoPalete: "PALETE_120X80" }),
    ).toEqual({ comprimentoMm: 1200, larguraMm: 800 });
    expect(
      dimensoesPaleteParagem({ paleteComprimentoMm: null, paleteLarguraMm: null, tipoPalete: "PALETE_120X100" }),
    ).toEqual({ comprimentoMm: 1200, larguraMm: 1000 });
  });

  it("paragem por peso (sem tipo) → null", () => {
    expect(
      dimensoesPaleteParagem({ paleteComprimentoMm: null, paleteLarguraMm: null, tipoPalete: null }),
    ).toBeNull();
  });
});
