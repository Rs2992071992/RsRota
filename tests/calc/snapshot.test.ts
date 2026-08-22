import { describe, it, expect } from "vitest";
import { derivarCustos } from "@/lib/calc/params";
import { calcularSnapshot } from "@/lib/calc/snapshot";
import { calcularParagem, type ContextoCalculo } from "@/lib/calc/perStop";
import { calcularRota } from "@/lib/calc/perRoute";
import type { ParagemInput } from "@/lib/calc/types";
import { PARAMS, PNEUS, TABELA_CONSUMO, TABELA_PORTAGENS } from "./fixtures";

const ctx: ContextoCalculo = {
  params: PARAMS,
  derivados: derivarCustos(PARAMS, PNEUS),
  tabelaConsumo: TABELA_CONSUMO,
  tabelaPortagens: TABELA_PORTAGENS,
};

// Motorista/veículo de teste = subconjuntos de PARAMS.
const MOTORISTA = {
  salarioMensal: PARAMS.salarioMensal,
  seguroMensal: PARAMS.seguroMensal,
  percentEncargos: PARAMS.percentEncargos,
  alimentacaoDia: PARAMS.alimentacaoDia,
  diasAlimentacao: PARAMS.diasAlimentacao,
  kmAnuais: PARAMS.kmAnuais,
  fatorAnualizacao: PARAMS.fatorAnualizacao,
};
const VEICULO = {
  valorAquisicao: PARAMS.valorAquisicao,
  valorResidual: PARAMS.valorResidual,
  vidaUtilAnos: PARAMS.vidaUtilAnos,
  iucAnual: PARAMS.iucAnual,
  taxaJuros: PARAMS.taxaJuros,
  seguroAnual: PARAMS.seguroAnual,
  reparacoesAnuais: PARAMS.reparacoesAnuais,
  revisaoAnual: PARAMS.revisaoAnual,
  inspecaoAnual: PARAMS.inspecaoAnual,
  capacidadeCamiao: PARAMS.capacidadeCamiao,
  capacidadeReboque: PARAMS.capacidadeReboque,
  capacidadePaleteA: PARAMS.capacidadePaleteA,
  capacidadePaleteB: PARAMS.capacidadePaleteB,
  capacidadePaleteACamiao: PARAMS.capacidadePaleteACamiao,
  capacidadePaleteBCamiao: PARAMS.capacidadePaleteBCamiao,
};

function hilp01(over: Partial<ParagemInput> = {}): ParagemInput {
  return {
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
    noitesFora: 0,
    alimentacao: 0,
    horasExtra: 0,
    receitaPaga: 0,
    ...over,
  };
}

describe("calcularSnapshot — equivalência com os parâmetros atuais", () => {
  it("motorista/veículo null reproduzem os custos/km de referência", () => {
    const s = calcularSnapshot(PARAMS, null, null, PNEUS);
    expect(s.custoMotoristaPorKm).toBeCloseTo(0.2671310526, 6);
    expect(s.custoVeiculoPorKm).toBeCloseTo(0.2746181287, 6);
  });

  it("snapshot derivado de PARAMS dá o mesmo custo de paragem que o contexto (797,2385 €)", () => {
    const snapshot = calcularSnapshot(PARAMS, MOTORISTA, VEICULO, PNEUS);
    const r = calcularParagem(hilp01({ snapshot }), ctx);
    expect(r.custoParagem).toBeCloseTo(797.2385251, 4);
  });
});

describe("snapshot por-motorista — salários diferentes dão custos diferentes", () => {
  it("salário mais alto -> custo motorista mais alto", () => {
    const caro = calcularSnapshot(PARAMS, { ...MOTORISTA, salarioMensal: 2000 }, VEICULO, PNEUS);
    const barato = calcularSnapshot(PARAMS, { ...MOTORISTA, salarioMensal: 1000 }, VEICULO, PNEUS);
    const rCaro = calcularParagem(hilp01({ snapshot: caro }), ctx);
    const rBarato = calcularParagem(hilp01({ snapshot: barato }), ctx);
    expect(rCaro.custoMotorista).toBeGreaterThan(rBarato.custoMotorista);
    // O custo do veículo não muda com o salário.
    expect(rCaro.custoVeiculo).toBeCloseTo(rBarato.custoVeiculo, 6);
  });
});

describe("histórico fixo — o snapshot congela os custos", () => {
  it("alterar o contexto atual não muda uma paragem que tem snapshot", () => {
    const snapshot = calcularSnapshot(PARAMS, MOTORISTA, VEICULO, PNEUS);
    const p = hilp01({ snapshot });

    const ctxAtual = calcularParagem(p, ctx).custoParagem;
    // Contexto com salários/precos muito diferentes — não deve afetar a paragem.
    const ctxAlterado: ContextoCalculo = {
      ...ctx,
      params: { ...PARAMS, precoCombRef: 3, valorNoite: 999 },
      derivados: derivarCustos({ ...PARAMS, salarioMensal: 9999 }, PNEUS),
    };
    const ctxNovo = calcularParagem(p, ctxAlterado).custoParagem;
    expect(ctxNovo).toBeCloseTo(ctxAtual, 6);
  });

  it("rota HILP01 com snapshots reproduz 1487,73 €", () => {
    const snapshot = calcularSnapshot(PARAMS, MOTORISTA, VEICULO, PNEUS);
    const paragens: ParagemInput[] = [
      hilp01({ snapshot, noitesFora: 1, alimentacao: 10, receitaPaga: 1700 }),
      hilp01({
        snapshot,
        cliente: "Vazio",
        tipoViagem: "Volta",
        tipoVeiculo: "VAZIO",
        kgCarregados: 0,
        alimentacao: 18,
        horasExtra: 1,
      }),
    ];
    const r = calcularRota("HILP01", paragens, ctx);
    expect(r.custoTotalRota).toBeCloseTo(1487.73305, 3);
    expect(r.lucro).toBeCloseTo(212.2669497, 3);
  });
});
