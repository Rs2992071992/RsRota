import { describe, it, expect } from "vitest";
import { consumoPorCarga, valorPortagem } from "@/lib/calc/lookups";
import { TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

describe("consumoPorCarga — VLOOKUP aproximado (escalão inferior)", () => {
  it("usa o escalão inferior entre dois", () => {
    expect(consumoPorCarga(0, TABELA_CONSUMO)).toBe(25);
    expect(consumoPorCarga(9999, TABELA_CONSUMO)).toBe(25);
    expect(consumoPorCarga(10000, TABELA_CONSUMO)).toBe(28);
    expect(consumoPorCarga(12000, TABELA_CONSUMO)).toBe(28);
    expect(consumoPorCarga(20000, TABELA_CONSUMO)).toBe(35);
    expect(consumoPorCarga(28000, TABELA_CONSUMO)).toBe(45); // caso HILP01
  });

  it("acima do último escalão usa o último", () => {
    expect(consumoPorCarga(50000, TABELA_CONSUMO)).toBe(45);
  });
});

describe("valorPortagem — lookup gracioso", () => {
  it("encontra a zona", () => {
    expect(valorPortagem("Galiza", TABELA_PORTAGENS)).toEqual({ valor: 72.7, existe: true });
    expect(valorPortagem("VilarFormoso", TABELA_PORTAGENS).valor).toBe(18.15);
  });

  it("zona inexistente devolve 0 e existe=false (sem #REF!)", () => {
    expect(valorPortagem("ZonaInventada", TABELA_PORTAGENS)).toEqual({ valor: 0, existe: false });
  });

  it("zona vazia é válida com valor 0", () => {
    expect(valorPortagem("", TABELA_PORTAGENS)).toEqual({ valor: 0, existe: true });
  });
});
