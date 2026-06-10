import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularRota } from "@/lib/calc/perRoute";
import type { ContextoCalculo } from "@/lib/calc/perStop";
import type { ParagemInput } from "@/lib/calc/types";
import { PARAMS, PNEUS, TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

const ctx: ContextoCalculo = {
  params: PARAMS,
  derivados: derivarCustos(PARAMS, PNEUS),
  tabelaConsumo: TABELA_CONSUMO,
  tabelaPortagens: TABELA_PORTAGENS,
};

// Rota HILP01 completa do Excel (rows 4 e 5).
// Resultado esperado: custo total = 1487,73 €, lucro = 212,27 €, OK.
const paragens: ParagemInput[] = [
  {
    idRota: "HILP01",
    cliente: "Hilplas Tecfil",
    tipoViagem: "Ida",
    tipoVeiculo: "CAMIAO+REBOQUE",
    kmInicial: 0,
    kmFinal: 580,
    kgCarregados: 28000,
    kgDescarregados: 0,
    zonaPortagem: "",
    portagensExtra: 0,
    noitesFora: 1, // 1 noite × 70 €/noite = 70 €
    alimentacao: 10,
    horasExtra: 0,
    receitaPaga: 1700,
  },
  {
    idRota: "HILP01",
    cliente: "Vazio",
    tipoViagem: "Volta",
    tipoVeiculo: "VAZIO",
    kmInicial: 0,
    kmFinal: 580,
    kgCarregados: 0,
    kgDescarregados: 0,
    zonaPortagem: "",
    portagensExtra: 0,
    noitesFora: 0,
    alimentacao: 18,
    horasExtra: 1,
    receitaPaga: 0,
  },
];

describe("calcularRota — rota HILP01 (reproduz o Excel)", () => {
  const r = calcularRota("HILP01", paragens, ctx);

  it("soma dos custos das paragens = 1381,733 €", () => {
    expect(r.somaCustoParagens).toBeCloseTo(1381.733, 2);
  });
  it("noites = 1 × 70 = 70, alimentação = 28, horas extra valorizadas = 8", () => {
    expect(r.somaNoites).toBe(70);
    expect(r.somaAlimentacao).toBe(28);
    expect(r.somaHorasExtraValor).toBe(8);
  });
  it("custo total da rota = 1487,73 € (Excel AF4)", () => {
    expect(r.custoTotalRota).toBeCloseTo(1487.73305, 3);
  });
  it("preço mínimo = custo × 1,25", () => {
    expect(r.precoMinimo).toBeCloseTo(1487.73305 * 1.25, 3);
  });
  it("receita = 1700, lucro = 212,27 € (Excel AI4), alerta OK", () => {
    expect(r.receitaTotal).toBe(1700);
    expect(r.lucro).toBeCloseTo(212.2669497, 3);
    expect(r.alerta).toBe("🟢 OK");
  });
  it("rateio: sobrecarga (28000/24000) dá coef ≈ 1,1667 e custo atribuído proporcional", () => {
    const hilplas = r.rateio.find((c) => c.cliente === "Hilplas Tecfil")!;
    expect(hilplas.coefReal).toBeCloseTo(28000 / 24000, 6);
    expect(hilplas.custoAtribuido).toBeCloseTo(1487.73305 * (28000 / 24000), 2);
  });
});

describe("calcularRota — rota em prejuízo dispara alerta vermelho", () => {
  const r = calcularRota(
    "HILP01",
    paragens.map((p, i) => (i === 0 ? { ...p, receitaPaga: 1000 } : p)),
    ctx,
  );
  it("receita 1000 < custo 1487 -> 🔴 PREJUÍZO", () => {
    expect(r.lucro).toBeLessThan(0);
    expect(r.alerta).toBe("🔴 PREJUÍZO");
  });
});
