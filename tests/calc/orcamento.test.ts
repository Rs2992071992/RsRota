import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularSnapshot } from "@/lib/calc/snapshot";
import { calcularParagem, type ContextoCalculo } from "@/lib/calc/perStop";
import {
  estimarLinha,
  totaisDevis,
  proximoNumeroDevis,
  kmComRegresso,
} from "@/lib/calc/orcamento";
import { PARAMS, PNEUS, TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const ctx: ContextoCalculo = {
  params: PARAMS,
  derivados: derivarCustos(PARAMS, PNEUS),
  tabelaConsumo: TABELA_CONSUMO,
  tabelaPortagens: TABELA_PORTAGENS,
};
const snapshot = calcularSnapshot(PARAMS, null, null, PNEUS);

describe("kmComRegresso", () => {
  it("ida e volta dobra a distância", () => expect(kmComRegresso(313, true)).toBe(626));
  it("só ida mantém a distância", () => expect(kmComRegresso(313, false)).toBe(313));
  it("arredonda ao km", () => expect(kmComRegresso(150.4, true)).toBe(301));
});

describe("estimarLinha — reutiliza o motor de paragem + portagem da tabela", () => {
  const input = {
    km: 580,
    pesoKg: 28000,
    tipoVeiculo: "CAMIAO+REBOQUE",
    zonaPortagem: "Galiza",
  };
  const est = estimarLinha(input, ctx, snapshot);

  // Referência: mesmo caso da paragem HILP01 (797,2385 €) + portagem Galiza (72,70 €).
  const ref = calcularParagem(
    {
      snapshot,
      idRota: "",
      cliente: "",
      tipoViagem: "Ida",
      tipoVeiculo: "CAMIAO+REBOQUE",
      kmInicial: 0,
      kmFinal: 580,
      kgCarregados: 28000,
      kgDescarregados: 0,
      zonaPortagem: "Galiza",
      portagensExtra: 0,
      noitesFora: 0,
      alimentacao: 0,
      horasExtra: 0,
      receitaPaga: 0,
    },
    ctx,
  );

  it("custo estimado = custo da paragem + portagem da tabela", () => {
    expect(est.custoEstimado).toBe(round2(ref.custoParagem + ref.portagemTabela));
  });
  it("preço sugerido = custo × margem mínima", () => {
    expect(est.precoSugerido).toBe(round2(est.custoEstimado * snapshot.margemMinima));
  });
  it("valores plausíveis (custo > 850 €, preço > custo)", () => {
    expect(est.custoEstimado).toBeGreaterThan(850);
    expect(est.precoSugerido).toBeGreaterThan(est.custoEstimado);
  });
  it("o detalhe decompõe o custo (soma das parcelas ≈ custo estimado)", () => {
    const d = est.detalhe;
    const soma =
      d.custoCombustivel +
      d.custoAdblue +
      d.custoMotorista +
      d.custoVeiculo +
      d.portagem +
      d.portagensExtra;
    expect(soma).toBeCloseTo(est.custoEstimado, 1);
  });
  it("sem override, a portagem vem da tabela por zona (Galiza = 72,70 €)", () => {
    expect(est.detalhe.portagemAuto).toBe(false);
    expect(est.detalhe.portagem).toBe(72.7);
  });
});

describe("estimarLinha — portagem automática (override TollGuru)", () => {
  const input = { km: 580, pesoKg: 28000, tipoVeiculo: "CAMIAO+REBOQUE", zonaPortagem: "Galiza" };
  const semOverride = estimarLinha(input, ctx, snapshot);
  const comOverride = estimarLinha(input, ctx, snapshot, 120);

  it("usa o override em vez da tabela e marca portagemAuto", () => {
    expect(comOverride.detalhe.portagemAuto).toBe(true);
    expect(comOverride.detalhe.portagem).toBe(120);
  });
  it("o custo reflete a diferença de portagem (120 − 72,70)", () => {
    expect(comOverride.custoEstimado - semOverride.custoEstimado).toBeCloseTo(120 - 72.7, 2);
  });
});

describe("estimarLinha — paletes (ocupação por nº; peso não entra, consumo = vazio)", () => {
  const input = { km: 100, pesoKg: 0, tipoVeiculo: "PALETE_120X80", nPaletes: 19, zonaPortagem: null };
  const est = estimarLinha(input, ctx, snapshot);
  const vazio = estimarLinha({ km: 100, pesoKg: 0, tipoVeiculo: "VAZIO", zonaPortagem: null }, ctx, snapshot);

  it("detalhe.coeficienteCarga = nPaletes/38, detalhe.nPaletes = 19", () => {
    expect(est.detalhe.nPaletes).toBe(19);
    expect(est.detalhe.coeficienteCarga).toBeCloseTo(19 / 38, 6);
  });
  it("consumo é igual ao de um trajeto vazio (paletes não pesam no cálculo)", () => {
    expect(est.detalhe.consumoL100).toBe(vazio.detalhe.consumoL100);
    expect(est.detalhe.custoCombustivel).toBeCloseTo(vazio.detalhe.custoCombustivel, 6);
  });
});

describe("estimarLinha — adicionais (noites fora + alimentação)", () => {
  const base = { km: 580, pesoKg: 28000, tipoVeiculo: "CAMIAO+REBOQUE", zonaPortagem: "Galiza" };
  const semAdicionais = estimarLinha(base, ctx, snapshot);
  const comAdicionais = estimarLinha(
    { ...base, noitesFora: 2, alimentacao: 15 },
    ctx,
    snapshot,
  );

  it("custo estimado soma noitesFora × valorNoite + alimentação", () => {
    const acrescimo = round2(2 * snapshot.valorNoite + 15);
    expect(comAdicionais.custoEstimado).toBe(round2(semAdicionais.custoEstimado + acrescimo));
  });
  it("o detalhe expõe noitesFora/valorNoite/custoNoites/alimentacao", () => {
    expect(comAdicionais.detalhe.noitesFora).toBe(2);
    expect(comAdicionais.detalhe.valorNoite).toBe(snapshot.valorNoite);
    expect(comAdicionais.detalhe.custoNoites).toBe(round2(2 * snapshot.valorNoite));
    expect(comAdicionais.detalhe.alimentacao).toBe(15);
  });
  it("sem noitesFora/alimentacao (retrocompatibilidade), custo fica igual ao caso base", () => {
    expect(semAdicionais.detalhe.noitesFora).toBe(0);
    expect(semAdicionais.detalhe.alimentacao).toBe(0);
    expect(semAdicionais.custoEstimado).toBe(
      round2(semAdicionais.detalhe.custoCombustivel +
        semAdicionais.detalhe.custoAdblue +
        semAdicionais.detalhe.custoMotorista +
        semAdicionais.detalhe.custoVeiculo +
        semAdicionais.detalhe.portagem +
        semAdicionais.detalhe.portagensExtra),
    );
  });
});

describe("totaisDevis", () => {
  it("soma preços + IVA, arredondado a 2 casas", () => {
    const t = totaisDevis([{ preco: 100 }, { preco: 50.5 }], 23);
    expect(t.subtotal).toBe(150.5);
    expect(t.ivaValor).toBe(34.62); // 150,5 × 0,23 = 34,615 -> 34,62
    expect(t.total).toBe(185.12);
  });
  it("IVA 0 % => total = subtotal", () => {
    const t = totaisDevis([{ preco: 200 }], 0);
    expect(t).toEqual({ subtotal: 200, ivaValor: 0, total: 200 });
  });
});

describe("proximoNumeroDevis", () => {
  it("primeiro do ano", () => expect(proximoNumeroDevis(2026, [])).toBe("ORC-2026-0001"));
  it("máximo do ano + 1 (ignora outros anos e buracos)", () => {
    const nums = ["ORC-2026-0001", "ORC-2026-0003", "ORC-2025-0009"];
    expect(proximoNumeroDevis(2026, nums)).toBe("ORC-2026-0004");
  });
  it("ano sem orçamentos recomeça em 0001", () => {
    expect(proximoNumeroDevis(2026, ["ORC-2025-0050"])).toBe("ORC-2026-0001");
  });
});
