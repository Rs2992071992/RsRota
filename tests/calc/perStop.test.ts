import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularParagem, coeficienteReal, paletesQueCabem, type ContextoCalculo } from "@/lib/calc/perStop";
import type { ParagemInput, ParagemSnapshot } from "@/lib/calc/types";
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

// Paletes por dimensão (2026-08-28) — único modo de rateio para paragens novas.
// Casos reais de produção (validados à mão, ver plano): AO-33-PJ e 08-SC-33
// (caixa 7500×2480), Lecitrailer (8150×2480) e Frenauf (7300×2480) — os
// tamanhos legado 1200×800/1200×1000 reproduzem exatamente os antigos
// capacidadePaleteA/B (38/30 e 36) para 3 dos 4 pares, confirmando a fórmula.
describe("paletesQueCabem — fórmula de área (testa as 2 orientações)", () => {
  it("AO-33-PJ (7500×2480) + palete 1200×800 -> 18", () => {
    expect(paletesQueCabem(7500, 2480, 1200, 800)).toBe(18);
  });
  it("AO-33-PJ (7500×2480) + palete 1200×1000 -> 14", () => {
    expect(paletesQueCabem(7500, 2480, 1200, 1000)).toBe(14);
  });
  it("Lecitrailer (8150×2480) + palete 1200×800 -> 20", () => {
    expect(paletesQueCabem(8150, 2480, 1200, 800)).toBe(20);
  });
  it("Lecitrailer (8150×2480) + palete 1200×1000 -> 16", () => {
    expect(paletesQueCabem(8150, 2480, 1200, 1000)).toBe(16);
  });
  it("Frenauf (7300×2480) + palete 1200×800 -> 18", () => {
    expect(paletesQueCabem(7300, 2480, 1200, 800)).toBe(18);
  });
  it("Frenauf (7300×2480) + palete 1200×1000 -> 14", () => {
    expect(paletesQueCabem(7300, 2480, 1200, 1000)).toBe(14);
  });
  it("orientação importa: a palete não roda inutilmente quando a orientação direita já é melhor", () => {
    // Caixa 10000×2480, palete 2600×1000: direita dá 2×3=6 (2480/1000 × 10000/2600);
    // rodada dá 0×10=0 (2480/2600 arredonda a 0) — tem de escolher a direita (6).
    expect(paletesQueCabem(10000, 2480, 2600, 1000)).toBe(6);
  });
});

function snapshotComCaixa(over: Partial<ParagemSnapshot> = {}): ParagemSnapshot {
  return {
    custoMotoristaPorKm: ctx.derivados.custoMotoristaPorKm,
    custoVeiculoPorKm: ctx.derivados.custoVeiculoPorKm,
    capacidadeCamiao: PARAMS.capacidadeCamiao,
    capacidadeReboque: PARAMS.capacidadeReboque,
    capacidadePaleteA: PARAMS.capacidadePaleteA,
    capacidadePaleteB: PARAMS.capacidadePaleteB,
    capacidadePaleteACamiao: PARAMS.capacidadePaleteACamiao,
    capacidadePaleteBCamiao: PARAMS.capacidadePaleteBCamiao,
    precoCombRef: PARAMS.precoCombRef,
    consumoAdblue: PARAMS.consumoAdblue,
    precoAdblue: PARAMS.precoAdblue,
    valorNoite: PARAMS.valorNoite,
    valorHoraExtra: PARAMS.valorHoraExtra,
    margemMinima: PARAMS.margemMinima,
    // AO-33-PJ + Lecitrailer (dados reais de produção).
    caixaComprimentoMm: 7500,
    caixaLarguraMm: 2480,
    caixaReboqueComprimentoMm: 8150,
    caixaReboqueLarguraMm: 2480,
    fatorOcupacaoPalete: 1,
    ...over,
  };
}

describe("calcularParagem — paletes por dimensão (2026-08-28, único modo para paragens novas)", () => {
  const eff = snapshotComCaixa();

  it("CAMIAO+REBOQUE, palete 1200×800: capacidade 18+20=38, coeficiente = nPaletes/38", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 30,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: eff,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(30 / 38, 6);
    expect(r.volume).toBe(true);
  });

  it("só CAMIAO (sem reboque): capacidade só do camião (18), não soma o reboque", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO",
      kmFinal: 100,
      nPaletes: 15,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: eff,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(15 / 18, 6);
  });

  it("fatorOcupacaoPalete reduz a capacidade calculada (0,5 -> metade)", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 19,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: snapshotComCaixa({ fatorOcupacaoPalete: 0.5 }),
    });
    const r = calcularParagem(p, ctx);
    // capacidade geométrica 38 × 0,5 = 19 -> coeficiente = 1.
    expect(r.coeficienteCarga).toBeCloseTo(1, 6);
  });

  it("veículo sem caixa configurada: capacidade 0, coeficiente 0 (nunca Infinity/NaN)", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 10,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: snapshotComCaixa({ caixaComprimentoMm: null, caixaLarguraMm: null }),
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBe(0);
    expect(Number.isFinite(r.coeficienteCarga)).toBe(true);
  });

  it("prioridade sobre o legado: dimensão própria vence mesmo com volume/tipoPalete preenchidos", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 30,
      volume: true,
      tipoPalete: "PALETE_120X100", // legado, daria 30/28 — não deve ser usado
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: eff,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(30 / 38, 6);
  });

  it("consumo usa o peso aproximado (deixa de forçar sempre vazio, 2026-08-28)", () => {
    const base = { tipoVeiculo: "CAMIAO+REBOQUE" as const, kmFinal: 100, nPaletes: 10, paleteComprimentoMm: 1200, paleteLarguraMm: 800, snapshot: eff };
    const semPeso = calcularParagem(paragemBase(base), ctx);
    const comPeso = calcularParagem(paragemBase({ ...base, pesoAproximado: 20000 }), ctx);
    expect(semPeso.consumoL100).toBe(25); // sem peso aproximado -> vazio, como sempre
    expect(comPeso.consumoL100).toBe(35); // 20000 kg -> escalão 35 L/100km da tabela
  });

  it("caminho antigo (string tipoPalete / headcount fixo) fica bit-a-bit igual", () => {
    const r = calcularParagem(
      paragemBase({ tipoVeiculo: "CAMIAO+REBOQUE", volume: true, tipoPalete: "PALETE_120X80", kmFinal: 100, nPaletes: 30 }),
      ctx,
    );
    expect(r.coeficienteCarga).toBeCloseTo(30 / 38, 6); // capacidadePaleteA legado, não a fórmula de área
  });
});

// Meias-paletes (2026-08-28+): empilhadas em cima de paletes de base, nunca
// ocupam uma base própria — só entram no numerador (0,5 cada), a capacidade
// (denominador) fica exatamente igual.
describe("calcularParagem — meias-paletes (não ocupam base própria)", () => {
  const eff = snapshotComCaixa();

  it("meia-palete soma 0,5 ao numerador, capacidade (38) fica igual", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 10,
      nMeiasPaletes: 4,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: eff,
    });
    const r = calcularParagem(p, ctx);
    // (10 + 4×0,5) / 38 = 12/38, não 14/38 (nunca conta como base cheia).
    expect(r.coeficienteCarga).toBeCloseTo(12 / 38, 6);
    expect(r.nMeiasPaletes).toBe(4);
  });

  it("só meias-paletes, sem base declarada: ainda assim só metade cada", () => {
    const p = paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      nPaletes: 0,
      nMeiasPaletes: 6,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      snapshot: eff,
    });
    const r = calcularParagem(p, ctx);
    expect(r.coeficienteCarga).toBeCloseTo(3 / 38, 6); // 6 × 0,5 = 3
  });

  it("caminho legado (headcount fixo) também aceita meias-paletes", () => {
    const r = calcularParagem(
      paragemBase({
        tipoVeiculo: "CAMIAO+REBOQUE",
        volume: true,
        tipoPalete: "PALETE_120X80",
        kmFinal: 100,
        nPaletes: 30,
        nMeiasPaletes: 2,
      }),
      ctx,
    );
    expect(r.coeficienteCarga).toBeCloseTo(31 / 38, 6); // (30 + 2×0,5) / 38
  });

  it("sem nMeiasPaletes (undefined/0): comportamento inalterado", () => {
    const r = calcularParagem(
      paragemBase({
        tipoVeiculo: "CAMIAO+REBOQUE",
        kmFinal: 100,
        nPaletes: 10,
        paleteComprimentoMm: 1200,
        paleteLarguraMm: 800,
        snapshot: eff,
      }),
      ctx,
    );
    expect(r.coeficienteCarga).toBeCloseTo(10 / 38, 6);
    expect(r.nMeiasPaletes).toBe(0);
  });
});

describe("coeficienteReal — paletes por dimensão (2026-08-28)", () => {
  const eff = snapshotComCaixa();

  it("CAMIAO+REBOQUE, palete 1200×800: nPaletes/38", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 19, false, null, 1200, 800)).toBeCloseTo(0.5, 6);
  });
  it("sem nPaletes -> 1 (mesma guarda do caminho legado)", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 0, false, null, 1200, 800)).toBe(1);
  });
  it("sobrecarga reflete-se (> 1)", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 50, false, null, 1200, 800)).toBeCloseTo(50 / 38, 6);
  });
  it("dimensão própria tem prioridade sobre volume/tipoPalete legado", () => {
    const comLegado = coeficienteReal("CAMIAO+REBOQUE", 0, eff, 30, true, "PALETE_120X100", 1200, 800);
    expect(comLegado).toBeCloseTo(30 / 38, 6); // usa 1200×800 (38), não PALETE_120X100 (28)
  });
  it("nMeiasPaletes soma 0,5 cada ao numerador, sem afetar a capacidade", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 10, false, null, 1200, 800, 4)).toBeCloseTo(12 / 38, 6);
  });
  it("só nMeiasPaletes (nPaletes=0): ainda calcula, não cai na guarda de 1", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 0, false, null, 1200, 800, 6)).toBeCloseTo(3 / 38, 6);
  });
  it("nem nPaletes nem nMeiasPaletes -> 1 (guarda inalterada)", () => {
    expect(coeficienteReal("CAMIAO+REBOQUE", 0, eff, 0, false, null, 1200, 800, 0)).toBe(1);
  });
});

// Paletes de tamanhos diferentes na MESMA paragem (2026-09): o coeficiente é a
// soma, por linha, de nPaletes / capacidade dessa dimensão.
describe("paletes multi-linha — tamanhos diferentes na mesma paragem", () => {
  const eff = snapshotComCaixa(); // 1200×800 -> cap 38 ; 1200×1000 -> cap 30

  const p2linhas = (over = {}) =>
    paragemBase({
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmFinal: 100,
      snapshot: eff,
      paletes: [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 10 },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 6 },
      ],
      ...over,
    });

  it("calcularParagem: coeficiente = Σ (nPaletesᵢ / capacidadeᵢ)", () => {
    const r = calcularParagem(p2linhas(), ctx);
    expect(r.coeficienteCarga).toBeCloseTo(10 / 38 + 6 / 30, 6);
    expect(r.nPaletes).toBe(16); // agregado das linhas
    expect(r.paletes).toHaveLength(2);
  });

  it("coeficienteReal: mesma soma via o parâmetro `paletes`", () => {
    const coef = coeficienteReal(
      "CAMIAO+REBOQUE",
      0,
      eff,
      0,
      false,
      null,
      null,
      null,
      0,
      [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 10 },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 6 },
      ],
    );
    expect(coef).toBeCloseTo(10 / 38 + 6 / 30, 6);
  });

  it("uma só linha em `paletes` == campos escalares equivalentes", () => {
    const viaArray = calcularParagem(
      p2linhas({ paletes: [{ tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 19 }] }),
      ctx,
    );
    const viaEscalar = calcularParagem(
      paragemBase({
        tipoVeiculo: "CAMIAO+REBOQUE",
        kmFinal: 100,
        snapshot: eff,
        nPaletes: 19,
        paleteComprimentoMm: 1200,
        paleteLarguraMm: 800,
      }),
      ctx,
    );
    expect(viaArray.coeficienteCarga).toBeCloseTo(viaEscalar.coeficienteCarga, 9);
    expect(viaArray.coeficienteCarga).toBeCloseTo(0.5, 6);
  });

  it("meias-paletes usam a capacidade da 1.ª linha", () => {
    const r = calcularParagem(p2linhas({ nMeiasPaletes: 4 }), ctx);
    expect(r.coeficienteCarga).toBeCloseTo(10 / 38 + 6 / 30 + (4 * 0.5) / 38, 6);
  });

  // Paragem "Descarga + Recolha" (2026-09): cada linha leva um `sentido`
  // (ENTREGA/RECOLHA) para o aviso de espaço, mas o coeficiente/rateio
  // continua a somar TODAS as linhas — o cliente paga pelo total.
  it("`sentido` não afeta o coeficiente — soma descarregadas + carregadas", () => {
    const r = calcularParagem(
      p2linhas({
        paletes: [
          { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 10, sentido: "ENTREGA" },
          { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 6, sentido: "RECOLHA" },
        ],
      }),
      ctx,
    );
    expect(r.coeficienteCarga).toBeCloseTo(10 / 38 + 6 / 30, 6);
    expect(r.nPaletes).toBe(16);
  });
});
