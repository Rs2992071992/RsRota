import { describe, it, expect } from "vitest";
import { ocupacaoPorParagem, gerarPlantaCargaRota, type ParagemCarga } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque", comprimentoMm: 8150, larguraMm: 2480 };
const P: { tipoPaleteId: number; comprimentoMm: number; larguraMm: number } = {
  tipoPaleteId: 1,
  comprimentoMm: 1300,
  larguraMm: 1100,
};

const entrega = (id: number, n: number, km: number, tipoVeiculo = "CAMIAO"): ParagemCarga => ({
  id,
  entregues: [{ ...P, nPaletes: n, clienteNome: `C${id}` }],
  recolhidas: [],
  tipoVeiculo,
  kmInicial: km,
});

describe("ocupacaoPorParagem", () => {
  it("a carga a bordo ao chegar desce à medida que se entrega", () => {
    // 4 + 4 + 2 paletes: a 1ª paragem chega com 10 a bordo, a 2ª com 6, a 3ª com 2.
    const r = ocupacaoPorParagem([CAMIAO], null, [entrega(1, 4, 0), entrega(2, 4, 100), entrega(3, 2, 200)]);
    expect(r.get(1)!).toBeGreaterThan(r.get(2)!);
    expect(r.get(2)!).toBeGreaterThan(r.get(3)!);
    expect(r.get(3)!).toBeGreaterThan(0);
    // 10 paletes de 1300x1100 numa caixa de 7500x2480: ~ 10*1.43m² / 18.6m² ≈ 77%
    expect(r.get(1)!).toBeCloseTo(((10 * 1300 * 1100) / (7500 * 2480)) * 100, 0);
  });

  it("o primeiro troço (maior carga) bate com a % da planta de pior momento", () => {
    const paragens = [entrega(1, 4, 0), entrega(2, 4, 100), entrega(3, 2, 200)];
    const planta = gerarPlantaCargaRota([CAMIAO], null, paragens)!;
    const pctPlanta = (planta.caixas[0].areaUsadaMm2 / planta.caixas[0].areaTotalMm2) * 100;
    const r = ocupacaoPorParagem([CAMIAO], null, paragens);
    expect(Math.max(...r.values())).toBeCloseTo(pctPlanta, 5);
  });

  it("sem nada a bordo (paragem vazia) dá 0 e sem caixa configurada não calcula", () => {
    const vazio: ParagemCarga = { id: 9, entregues: [], recolhidas: [], tipoVeiculo: "VAZIO", kmInicial: 500 };
    const r = ocupacaoPorParagem([CAMIAO], null, [entrega(1, 4, 0), vazio]);
    expect(r.get(9)).toBe(0);
    expect(ocupacaoPorParagem([], null, [entrega(1, 4, 0)]).size).toBe(0);
  });

  it("com reboque atrelado a % usa a área do camião + reboque", () => {
    const sem = ocupacaoPorParagem([CAMIAO], null, [entrega(1, 8, 0, "CAMIAO+REBOQUE")]).get(1)!;
    const com = ocupacaoPorParagem([CAMIAO], REBOQUE, [entrega(1, 8, 0, "CAMIAO+REBOQUE")]).get(1)!;
    expect(com).toBeLessThan(sem);
    expect(com).toBeCloseTo(((8 * 1300 * 1100) / ((7500 + 8150) * 2480)) * 100, 0);
  });

  it("ignora paragens sem id", () => {
    const semId = { ...entrega(1, 4, 0), id: undefined };
    expect(ocupacaoPorParagem([CAMIAO], null, [semId]).size).toBe(0);
  });
});
