import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularRota, pesosEmTransito } from "@/lib/calc/perRoute";
import type { ContextoCalculo } from "@/lib/calc/perStop";
import type { ParagemInput } from "@/lib/calc/types";
import { PARAMS, PNEUS, TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

function paragemBase(over: Partial<ParagemInput> = {}): ParagemInput {
  return {
    idRota: "T",
    data: "2026-01-01",
    cliente: "C",
    tipoViagem: "Ida",
    tipoVeiculo: "CAMIAO+REBOQUE",
    kmInicial: 0,
    kmFinal: 0,
    kgCarregados: 0,
    kgDescarregados: 0,
    zonaPortagem: "",
    portagensExtra: 0,
    noitesFora: 0,
    alimentacao: 0,
    horasExtra: 0,
    receitaPaga: 0,
    ...over,
  };
}

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

describe("calcularRota — rateio misto peso + paletes normaliza a 100 %", () => {
  const mista: ParagemInput[] = [
    { idRota: "MIX01", cliente: "Cliente Peso", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 0, kmFinal: 300, kgCarregados: 12000, kgDescarregados: 0, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 1000 },
    { idRota: "MIX01", cliente: "Cliente Paletes A", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", volume: true, tipoPalete: "PALETE_120X80", kmInicial: 300, kmFinal: 450, kgCarregados: 1200, kgDescarregados: 0, nPaletes: 19, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 500 },
    { idRota: "MIX01", cliente: "Cliente Paletes B", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", volume: true, tipoPalete: "PALETE_120X100", kmInicial: 450, kmFinal: 550, kgCarregados: 900, kgDescarregados: 0, nPaletes: 14, zonaPortagem: "", portagensExtra: 0, noitesFora: 0, alimentacao: 0, horasExtra: 0, receitaPaga: 300 },
  ];
  const r = calcularRota("MIX01", mista, ctx);

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
  it("clientes de paletes usam nPaletes/capacidade, não peso/capacidade kg", () => {
    const paletesA = r.rateio.find((c) => c.cliente === "Cliente Paletes A")!;
    const paletesB = r.rateio.find((c) => c.cliente === "Cliente Paletes B")!;
    expect(paletesA.coefReal).toBeCloseTo(19 / 38, 6);
    expect(paletesB.coefReal).toBeCloseTo(14 / 28, 6);
  });
});

// Reproduz o cenário real (rota RIC-Tec-eurored): recolha num fornecedor,
// material entregue mais tarde ao cliente final — o fornecedor não deve
// pagar rateio, o custo soma-se à quota do cliente indicado em `faturarCliente`.
describe("calcularRota — recolha (faturarCliente) soma-se à quota do cliente indicado", () => {
  const recolha: ParagemInput[] = [
    paragemBase({
      cliente: "Fornecedor",
      kmInicial: 0,
      kmFinal: 100,
      kgCarregados: 1000,
      faturarCliente: "Cliente Final",
    }),
    paragemBase({
      cliente: "Cliente Final",
      kmInicial: 100,
      kmFinal: 250,
      kgDescarregados: 1000,
      receitaPaga: 800,
    }),
  ];
  const r = calcularRota("REC01", recolha, ctx);

  it("o fornecedor (recolha) não aparece no rateio", () => {
    expect(r.rateio.find((c) => c.cliente === "Fornecedor")).toBeUndefined();
    expect(r.rateio).toHaveLength(1);
  });
  it("o cliente final paga 100 % da rota (Σ quotas = 1)", () => {
    const clienteFinal = r.rateio.find((c) => c.cliente === "Cliente Final")!;
    expect(clienteFinal.quota).toBeCloseTo(1, 6);
    expect(clienteFinal.custoAtribuido).toBeCloseTo(r.custoTotalRota, 6);
  });
  it("o custo da recolha continua incluído no total da rota (não desaparece)", () => {
    const soCliente = calcularRota("REC01", [recolha[1]], ctx);
    expect(r.custoTotalRota).toBeGreaterThan(soCliente.custoTotalRota);
  });
  it("Σ custo atribuído = custo total da rota", () => {
    const soma = r.rateio.reduce((a, c) => a + c.custoAtribuido, 0);
    expect(soma).toBeCloseTo(r.custoTotalRota, 6);
  });
});

// Prova que a recolha soma-se especificamente à quota do cliente indicado —
// não dilui por todos os clientes faturáveis da rota (diferença chave vs. só
// excluir a paragem do rateio).
describe("calcularRota — recolha soma-se só ao cliente indicado, não dilui pelos outros", () => {
  const mistaComRecolha: ParagemInput[] = [
    paragemBase({
      cliente: "Fornecedor",
      kmInicial: 0,
      kmFinal: 50,
      kgCarregados: 500,
      faturarCliente: "Cliente Final",
    }),
    paragemBase({
      cliente: "Cliente Final",
      kmInicial: 50,
      kmFinal: 150,
      kgDescarregados: 2000,
      receitaPaga: 1000,
    }),
    paragemBase({
      cliente: "Cliente Outro",
      kmInicial: 150,
      kmFinal: 250,
      kgDescarregados: 1000,
      receitaPaga: 500,
    }),
  ];
  const r = calcularRota("REC02", mistaComRecolha, ctx);
  const capReboque = 24000; // ver tests/calc/fixtures.ts (PARAMS.capacidadeReboque)

  it("Cliente Outro só paga o seu próprio coeficiente (inalterado pela recolha)", () => {
    const clienteOutro = r.rateio.find((c) => c.cliente === "Cliente Outro")!;
    expect(clienteOutro.coefReal).toBeCloseTo(1000 / capReboque, 6);
  });
  it("Cliente Final paga o seu coeficiente + o da recolha (soma, não dilui)", () => {
    const clienteFinal = r.rateio.find((c) => c.cliente === "Cliente Final")!;
    expect(clienteFinal.coefReal).toBeCloseTo(2000 / capReboque + 500 / capReboque, 6);
  });
  it("Σ custo atribuído = custo total da rota", () => {
    const soma = r.rateio.reduce((a, c) => a + c.custoAtribuido, 0);
    expect(soma).toBeCloseTo(r.custoTotalRota, 6);
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

describe("pesosEmTransito", () => {
  it("grupo de 1 paragem -> undefined (sem correção, comportamento de hoje)", () => {
    const [p] = pesosEmTransito([paragemBase({ kgCarregados: 28000 })]);
    expect(p).toBeUndefined();
  });

  it("entrega progressiva (só kgDescarregados) -> peso vai descendo", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 100, kgDescarregados: 5000 }),
      paragemBase({ cliente: "B", kmInicial: 100, kmFinal: 200, kgDescarregados: 3000 }),
      paragemBase({ cliente: "C", kmInicial: 200, kmFinal: 300, kgDescarregados: 2000 }),
    ]);
    expect(r).toEqual([10000, 5000, 2000]);
  });

  it("recolha progressiva (só kgCarregados) -> peso vai subindo", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", tipoViagem: "Volta", kmInicial: 0, kmFinal: 100, kgCarregados: 2000 }),
      paragemBase({ cliente: "B", tipoViagem: "Volta", kmInicial: 100, kmFinal: 200, kgCarregados: 3000 }),
      paragemBase({ cliente: "C", tipoViagem: "Volta", kmInicial: 200, kmFinal: 300, kgCarregados: 5000 }),
    ]);
    expect(r).toEqual([0, 2000, 5000]);
  });

  it("grupo misto (recolha a meio de uma entrega, como um backhaul real)", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 100, kgCarregados: 100, kgDescarregados: 1000 }),
      paragemBase({ cliente: "B", kmInicial: 100, kmFinal: 200, kgDescarregados: 500 }),
    ]);
    expect(r).toEqual([1500, 600]);
  });

  it("paragens VAZIO cortam o grupo em segmentos (o peso não atravessa)", () => {
    // A e B, mesma direção/dia, com um Vazio no meio: o camião esvaziou ali,
    // por isso A e B ficam cada um sozinho no seu segmento (grupo de 1 -> sem
    // correção, usa o peso próprio) — já não se juntam como antes.
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 100, kgDescarregados: 1000 }),
      paragemBase({ cliente: "Vazio", tipoVeiculo: "VAZIO", kmInicial: 50, kmFinal: 150 }),
      paragemBase({ cliente: "B", kmInicial: 100, kmFinal: 200, kgDescarregados: 500 }),
    ]);
    expect(r).toEqual([undefined, undefined, undefined]);
  });

  it("tipoViagem ou dia diferentes -> grupos separados (rota multi-dia com idRota reutilizado)", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", data: "2026-01-01", kmInicial: 0, kmFinal: 100, kgDescarregados: 1000 }),
      paragemBase({ cliente: "B", data: "2026-01-01", kmInicial: 100, kmFinal: 200, kgDescarregados: 500 }),
      paragemBase({ cliente: "C", data: "2026-01-02", kmInicial: 0, kmFinal: 100, kgDescarregados: 700 }),
      paragemBase({ cliente: "D", data: "2026-01-02", kmInicial: 100, kmFinal: 200, kgDescarregados: 300 }),
    ]);
    // Dia 1 (A,B): total 1500 a descer. Dia 2 (C,D): total 1000 a descer,
    // independente do dia 1 — nunca se juntam num só grupo de 4.
    expect(r).toEqual([1500, 500, 1000, 300]);
  });

  it("ordena por kmInicial, não pela ordem de entrada no array", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "B", kmInicial: 100, kmFinal: 200, kgDescarregados: 3000 }),
      paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 100, kgDescarregados: 5000 }),
    ]);
    // índice 0 é "B" (2º na sequência física) -> 3000; índice 1 é "A" (1º) -> 8000.
    expect(r).toEqual([3000, 8000]);
  });

  it("recolhas ligadas por faturarCliente atravessam dia e direção (caso real RIC-Tec-eurored, simplificado)", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", data: "2026-01-01", tipoViagem: "Ida", kmInicial: 0, kmFinal: 10, kgCarregados: 40, faturarCliente: "Tecfil" }),
      paragemBase({ cliente: "B", data: "2026-01-01", tipoViagem: "Ida", kmInicial: 10, kmFinal: 20, kgCarregados: 1800, faturarCliente: "Tecfil" }),
      paragemBase({ cliente: "C", data: "2026-01-02", tipoViagem: "Volta", kmInicial: 20, kmFinal: 30, kgCarregados: 932, faturarCliente: "Tecfil" }),
      paragemBase({ cliente: "Tecfil", data: "2026-01-02", tipoViagem: "Volta", kmInicial: 30, kmFinal: 40, kgDescarregados: 2772 }),
    ]);
    // A linha começa vazia (0) e só acumula o que é apanhado — atravessa a
    // mudança de dia e de direção sem quebra, porque faturarCliente liga
    // as 3 recolhas à entrega na própria Tecfil.
    expect(r).toEqual([0, 40, 1840, 2772]);
  });

  it("faturarCliente sem entrega correspondente na rota não forma linha (soma-se ao grupo normal, como sempre)", () => {
    const r = pesosEmTransito([
      paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 100, kgCarregados: 100, faturarCliente: "ClienteForaDaqui" }),
      paragemBase({ cliente: "B", kmInicial: 100, kmFinal: 200, kgDescarregados: 500 }),
    ]);
    // "ClienteForaDaqui" nunca aparece como `cliente` nesta rota -> sem
    // linha; A e B ficam no grupo normal (mesma direção/dia), tal como o
    // teste "grupo misto" já cobre.
    expect(r).toEqual([500, 600]);
  });

  it("uma linha não contamina o grupo normal do resto da rota", () => {
    const r = pesosEmTransito([
      // Linha Tecfil (fora do agrupamento normal por completo).
      paragemBase({ cliente: "Fornecedor", kmInicial: 0, kmFinal: 50, kgCarregados: 200, faturarCliente: "Tecfil" }),
      paragemBase({ cliente: "Tecfil", kmInicial: 50, kmFinal: 100, kgDescarregados: 200 }),
      // Grupo normal, sem nenhuma ligação — mesma direção/dia de sempre.
      paragemBase({ cliente: "X", kmInicial: 100, kmFinal: 150, kgDescarregados: 1000 }),
      paragemBase({ cliente: "Y", kmInicial: 150, kmFinal: 200, kgDescarregados: 500 }),
    ]);
    expect(r).toEqual([0, 200, 1500, 500]);
  });
});

describe("calcularRota — peso em trânsito muda o consumo por troço (entrega progressiva)", () => {
  // 3 clientes na mesma rota/dia, camião a descarregar progressivamente:
  // 25000kg no total, entregues 15000+7000+3000 em 3 troços sucessivos.
  const multi: ParagemInput[] = [
    paragemBase({ cliente: "A", kmInicial: 0, kmFinal: 200, kgDescarregados: 15000, receitaPaga: 1000 }),
    paragemBase({ cliente: "B", kmInicial: 200, kmFinal: 350, kgDescarregados: 7000, receitaPaga: 600 }),
    paragemBase({ cliente: "C", kmInicial: 350, kmFinal: 450, kgDescarregados: 3000, receitaPaga: 300 }),
  ];
  const r = calcularRota("MULTI01", multi, ctx);

  it("consumo por troço reflete o peso real a bordo (38, 28, 25 L/100km), não o peso próprio (31, 25, 25)", () => {
    expect(r.paragens[0].consumoL100).toBe(38); // 25000kg a bordo no troço 1 (peso próprio seria 15000 -> 31)
    expect(r.paragens[1].consumoL100).toBe(28); // 10000kg a bordo no troço 2 (peso próprio seria 7000 -> 25)
    expect(r.paragens[2].consumoL100).toBe(25); // 3000kg no último troço = igual ao peso próprio (nada mudou)
  });

  it("litros/custo de combustível do troço 1 usam o consumo de 38 L/100km sobre 200km", () => {
    expect(r.paragens[0].litrosGastos).toBeCloseTo(76, 6); // 38/100 * 200
    expect(r.paragens[0].custoCombustivel).toBeCloseTo(76 * PARAMS.precoCombRef, 6);
  });

  it("coeficiente de carga e rateio continuam a usar o peso próprio de cada cliente (inalterado)", () => {
    const cap = PARAMS.capacidadeReboque; // CAMIAO+REBOQUE
    expect(r.paragens[0].coeficienteCarga).toBeCloseTo(15000 / cap, 6);
    expect(r.paragens[1].coeficienteCarga).toBeCloseTo(7000 / cap, 6);
    const a = r.rateio.find((c) => c.cliente === "A")!;
    const b = r.rateio.find((c) => c.cliente === "B")!;
    expect(a.coefReal).toBeCloseTo(15000 / cap, 6);
    expect(b.coefReal).toBeCloseTo(7000 / cap, 6);
  });

  it("Σ custo atribuído = custo total da rota (rateio continua consistente)", () => {
    const soma = r.rateio.reduce((a, c) => a + c.custoAtribuido, 0);
    expect(soma).toBeCloseTo(r.custoTotalRota, 6);
  });
});
