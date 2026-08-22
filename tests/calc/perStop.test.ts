import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularParagem, coeficienteReal, type ContextoCalculo } from "@/lib/calc/perStop";
import type { ParagemInput } from "@/lib/calc/types";
import { PARAMS, PNEUS, TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

const ctx: ContextoCalculo = {
  params: PARAMS,
  derivados: derivarCustos(PARAMS, PNEUS),
  tabelaConsumo: TABELA_CONSUMO,
  tabelaPortagens: TABELA_PORTAGENS,
};

function paragemBase(over: Partial<ParagemInput> = {}): ParagemInput {
  return {
    idRota: "T",
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

describe("calcularParagem — caso de referência HILP01 (Excel row 4)", () => {
  // CAMIAO+REBOQUE, peso 28.000 kg, 580 km -> custo paragem = 797,2385 €
  const p = paragemBase({
    tipoVeiculo: "CAMIAO+REBOQUE",
    kmInicial: 0,
    kmFinal: 580,
    kgCarregados: 28000,
  });
  const r = calcularParagem(p, ctx);

  it("km feitos = 580", () => expect(r.kmFeitos).toBe(580));
  it("consumo = 45 L/100km", () => expect(r.consumoL100).toBe(45));
  it("litros gastos = 261", () => expect(r.litrosGastos).toBeCloseTo(261, 6));
  it("custo combustível = 478,674 €", () => expect(r.custoCombustivel).toBeCloseTo(478.674, 3));
  it("AdBlue = 14,5 L -> 4,35 €", () => {
    expect(r.adblueLitros).toBeCloseTo(14.5, 6);
    expect(r.custoAdblue).toBeCloseTo(4.35, 6);
  });
  it("custo motorista = 154,936 €", () => expect(r.custoMotorista).toBeCloseTo(154.9360105, 4));
  it("custo veículo = 159,2785 €", () => expect(r.custoVeiculo).toBeCloseTo(159.2785146, 4));
  it("custo da paragem = 797,2385 € (caso real do Excel)", () => {
    expect(r.custoParagem).toBeCloseTo(797.2385251, 4);
  });
  it("coeficiente de carga = 28000/24000 ≈ 1,1667", () => {
    expect(r.coeficienteCarga).toBeCloseTo(1.16666667, 6);
  });
});

describe("calcularParagem — paragem VAZIO de volta (Excel row 5)", () => {
  const p = paragemBase({
    tipoVeiculo: "VAZIO",
    cliente: "Vazio",
    kmInicial: 0,
    kmFinal: 580,
    alimentacao: 18,
    horasExtra: 1,
  });
  const r = calcularParagem(p, ctx);

  it("peso 0 -> consumo base 25, combustível = 265,93 €", () => {
    expect(r.consumoL100).toBe(25);
    expect(r.custoCombustivel).toBeCloseTo(265.93, 4);
  });
  it("custo da paragem = 584,4945 €", () => {
    expect(r.custoParagem).toBeCloseTo(584.4945251, 4);
  });
  it("preço por kg = 0 quando peso = 0 (sem divisão por zero)", () => {
    expect(r.precoPorKg).toBe(0);
  });
});

describe("coeficienteReal — sem limite a 1 (sobrecarga reflete-se)", () => {
  it("VAZIO -> 1", () => {
    expect(coeficienteReal("VAZIO", 10000, PARAMS)).toBe(1);
  });
  it("peso 0 -> 1", () => expect(coeficienteReal("CAMIAO", 0, PARAMS)).toBe(1));
  it("CAMIAO usa capacidade 14.000 e pode passar de 1", () => {
    expect(coeficienteReal("CAMIAO", 7000, PARAMS)).toBeCloseTo(0.5, 6);
    expect(coeficienteReal("CAMIAO", 20000, PARAMS)).toBeCloseTo(20000 / 14000, 6); // > 1
  });
  it("CAMIAO+REBOQUE usa capacidade 24.000 e pode passar de 1", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 12000, PARAMS)).toBeCloseTo(0.5, 6);
    // Sobrecarga 29.890 kg -> coef ≈ 1,245 (caso real da rota E8).
    expect(coeficienteReal("CAMIAO+REBOQUE", 29890, PARAMS)).toBeCloseTo(29890 / 24000, 6);
  });
});

describe("calcularParagem — paletes (ocupação por nº, peso não entra no registo)", () => {
  it("volume + PALETE_120X80 + CAMIAO+REBOQUE: coeficiente = nPaletes/38 (capacidade do conjunto)", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      volume: true,
      tipoPalete: "PALETE_120X80",
      kmFinal: 100,
      nPaletes: 30,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(30 / 38, 6);
    expect(r.nPaletes).toBe(30);
    expect(r.volume).toBe(true);
    expect(r.tipoPalete).toBe("PALETE_120X80");
  });

  it("volume + PALETE_120X100 + CAMIAO+REBOQUE: coeficiente = nPaletes/28, sobrecarga dá > 1", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      volume: true,
      tipoPalete: "PALETE_120X100",
      kmFinal: 100,
      nPaletes: 35,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(35 / 28, 6);
  });

  it("volume + CAMIAO (sem reboque): usa as capacidades 'só camião' (18/14), não as do conjunto", () => {
    const a = calcularParagem(
      paragemBase({ tipoVeiculo: "CAMIAO", volume: true, tipoPalete: "PALETE_120X80", kmFinal: 100, nPaletes: 15 }),
      ctx,
    );
    expect(a.coeficienteCarga).toBeCloseTo(15 / 18, 6);
    const b = calcularParagem(
      paragemBase({ tipoVeiculo: "CAMIAO", volume: true, tipoPalete: "PALETE_120X100", kmFinal: 100, nPaletes: 12 }),
      ctx,
    );
    expect(b.coeficienteCarga).toBeCloseTo(12 / 14, 6);
  });

  it("fallback de compatibilidade: tipoVeiculo ainda literalmente PALETE_120X80/100 (dados anteriores à migração) continua a usar a capacidade do conjunto", () => {
    const r = calcularParagem(paragemBase({ tipoVeiculo: "PALETE_120X80", kmFinal: 100, nPaletes: 30 }), ctx);
    expect(r.coeficienteCarga).toBeCloseTo(30 / 38, 6);
    expect(r.volume).toBe(true);
    expect(r.tipoPalete).toBe("PALETE_120X80");
  });

  it("consumo de combustível = sempre como vazio, mesmo se algum peso ficar registado", () => {
    const vazio = calcularParagem(paragemBase({ tipoVeiculo: "VAZIO", kmFinal: 100 }), ctx);
    const semPeso = calcularParagem(
      paragemBase({ tipoVeiculo: "CAMIAO+REBOQUE", volume: true, tipoPalete: "PALETE_120X80", kmFinal: 100, nPaletes: 30 }),
      ctx,
    );
    // Mesmo com peso residual acima do 1º escalão da tabela de consumo (ex.:
    // dado antigo ou erro de input — 12000kg cairia no escalão de 10000kg,
    // 28 L/100km, se o peso fosse considerado), o consumo das paletes tem de
    // se manter igual ao vazio — é uma regra explícita do motor, não uma
    // coincidência da tabela.
    const comPesoResidual = calcularParagem(
      paragemBase({
        tipoVeiculo: "CAMIAO+REBOQUE",
        volume: true,
        tipoPalete: "PALETE_120X80",
        kmFinal: 100,
        nPaletes: 30,
        kgCarregados: 12000,
      }),
      ctx,
    );
    expect(semPeso.consumoL100).toBe(vazio.consumoL100);
    expect(comPesoResidual.consumoL100).toBe(vazio.consumoL100);
    expect(comPesoResidual.custoCombustivel).toBeCloseTo(vazio.custoCombustivel, 6);
  });
});

describe("coeficienteReal — paletes (parâmetros novos opcionais, não quebram chamadas antigas)", () => {
  it("volume + PALETE_120X80 + CAMIAO+REBOQUE: nPaletes/38", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, PARAMS, 19, true, "PALETE_120X80")).toBeCloseTo(0.5, 6);
  });
  it("volume + PALETE_120X100 + CAMIAO+REBOQUE: nPaletes/28, sobrecarga > 1", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, PARAMS, 35, true, "PALETE_120X100")).toBeCloseTo(35 / 28, 6);
  });
  it("volume + CAMIAO (sem reboque): nPaletes/18 (capacidade só-camião)", () => {
    expect(coeficienteReal("CAMIAO", 0, PARAMS, 15, true, "PALETE_120X80")).toBeCloseTo(15 / 18, 6);
  });
  it("volume com nPaletes 0 (não informado) -> 1, não cai no branch peso<=0 genérico", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, PARAMS, 0, true, "PALETE_120X80")).toBe(1);
  });
  it("fallback de compatibilidade: chamada 'à moda antiga' (sem volume/tipoPalete), tipoVeiculo ainda PALETE_120X80, continua a funcionar", () => {
    expect(coeficienteReal("PALETE_120X80", 0, PARAMS, 19)).toBeCloseTo(0.5, 6);
    expect(coeficienteReal("PALETE_120X100", 0, PARAMS, 35)).toBeCloseTo(35 / 28, 6);
  });
});

describe("colunas Espanha — informativas, poupança", () => {
  it("poupança = litros × (preço ref − preço Espanha)", () => {
    const p = paragemBase({ kmFinal: 100, litrosEspanha: 100, custoEspanha: 150 });
    const r = calcularParagem(p, ctx);
    // 100 × 1,834 − 150 = 33,4
    expect(r.poupancaEspanha).toBeCloseTo(33.4, 4);
  });

  it("com preço de referência corrigido por rota, a poupança usa esse preço (não o de Parâmetros)", () => {
    const p = paragemBase({
      kmFinal: 100,
      litrosEspanha: 100,
      custoEspanha: 150,
      precoCombRefOverride: 2,
    });
    const r = calcularParagem(p, ctx);
    // 100 × 2 (override da rota, não os 1,834 de Parâmetros) − 150 = 50
    expect(r.poupancaEspanha).toBeCloseTo(50, 4);
  });
});
