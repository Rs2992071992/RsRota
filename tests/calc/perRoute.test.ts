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
  it("rateio: único cliente real paga 100 % (trajeto VAZIO excluído, sem linha fantasma)", () => {
    const hilplas = r.rateio.find((c) => c.cliente === "Hilplas Tecfil")!;
    // Coef. real continua a refletir a sobrecarga (indicador).
    expect(hilplas.coefReal).toBeCloseTo(28000 / 24000, 6);
    // Mas a quota normaliza a 100 % (é o único cliente; o VAZIO não participa).
    expect(hilplas.quota).toBeCloseTo(1, 6);
    expect(hilplas.custoAtribuido).toBeCloseTo(1487.73305, 2);
    // O trajeto a vazio não gera linha própria.
    expect(r.rateio.find((c) => c.cliente === "Vazio")).toBeUndefined();
  });
});

describe("calcularRota — rateio multi-cliente normaliza a 100 % (cenário Espanha)", () => {
  // 4 clientes carregados + retorno a vazio. Verifica os invariantes do rateio.
  const espanha: ParagemInput[] = [
    { idRota: "ESP01", cliente: "Cliente A", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 0, kmFinal: 300, kgCarregados: 12000, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 1200 },
    { idRota: "ESP01", cliente: "Cliente B", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 300, kmFinal: 450, kgCarregados: 6000, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 600 },
    { idRota: "ESP01", cliente: "Cliente C", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 450, kmFinal: 550, kgCarregados: 3000, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 400 },
    { idRota: "ESP01", cliente: "Cliente D", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 550, kmFinal: 650, kgCarregados: 3000, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 400 },
    { idRota: "ESP01", cliente: "Vazio", tipoViagem: "Volta", tipoVeiculo: "VAZIO", kmInicial: 650, kmFinal: 1300, kgCarregados: 0, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 0 },
  ];
  const r = calcularRota("ESP01", espanha, ctx);

  it("Σ custo atribuído = custo total da rota", () => {
    const soma = r.rateio.reduce((a, c) => a + c.custoAtribuido, 0);
    expect(soma).toBeCloseTo(r.custoTotalRota, 6);
  });
  it("Σ quotas = 100 %", () => {
    const soma = r.rateio.reduce((a, c) => a + c.quota, 0);
    expect(soma).toBeCloseTo(1, 6);
  });
  it("Σ margens por cliente = lucro da rota", () => {
    const somaMargens = r.rateio.reduce((a, c) => a + (c.receitaPaga - c.custoAtribuido), 0);
    expect(somaMargens).toBeCloseTo(r.lucro, 6);
  });
  it("o retorno a vazio não aparece como cliente", () => {
    expect(r.rateio.find((c) => c.cliente === "Vazio")).toBeUndefined();
    expect(r.rateio).toHaveLength(4);
  });
  it("o cliente com mais carga paga mais (A > B > C = D)", () => {
    const get = (n: string) => r.rateio.find((c) => c.cliente === n)!.custoAtribuido;
    expect(get("Cliente A")).toBeGreaterThan(get("Cliente B"));
    expect(get("Cliente B")).toBeGreaterThan(get("Cliente C"));
    expect(get("Cliente C")).toBeCloseTo(get("Cliente D"), 6);
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
