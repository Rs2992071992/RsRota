import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { PARAMS, PNEUS } from "./fixtures";

describe("derivarCustos — constantes validadas contra o Excel", () => {
  const d = derivarCustos(PARAMS, PNEUS);

  it("custo motorista por km ≈ 0,26713 €/km", () => {
    expect(d.custoMotoristaPorKm).toBeCloseTo(0.2671310526, 6);
  });

  it("custo do veículo por km ≈ 0,2746 €/km", () => {
    expect(d.custoVeiculoPorKm).toBeCloseTo(0.2746181287, 6);
  });

  it("custo mensal do motorista = 1812,675 €", () => {
    expect(d.detalhe.custoMensalMotorista).toBeCloseTo(1812.675, 3);
  });

  it("custos fixos anuais do veículo = 20.140 €", () => {
    expect(d.detalhe.custosFixosAnuais).toBeCloseTo(20140, 2);
  });

  it("custo fixo anual por km = 0,212 €/km", () => {
    expect(d.detalhe.custoFixoAnualKm).toBeCloseTo(0.212, 6);
  });

  it("pneus por km ≈ 0,033144 €/km", () => {
    expect(d.detalhe.pneusKm).toBeCloseTo(0.03314444444, 8);
  });

  it("depreciação anual = 13.000 € e juros anuais = 2.540 €", () => {
    expect(d.detalhe.depreciacaoAnual).toBeCloseTo(13000, 2);
    expect(d.detalhe.jurosAnuais).toBeCloseTo(2540, 2);
  });
});
