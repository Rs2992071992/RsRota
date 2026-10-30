import { describe, it, expect } from "vitest";
import { empacotar, empacotarComRotacoes, type CaixaInput, type PaleteUnidade } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };

// Carga real da rota RIC-Tec-maravedis (Ida), na ordem de carga: com a regra
// fixa de `empacotar` fica 1 palete de fora, mas há combinações de orientações
// em que cabem as 15.
const MEDIDAS: [string, number, number][] = [
  ["Tec-maravilhas soltas", 1100, 1100], ["Tec-maravilhas soltas", 1100, 1100],
  ["Tec-Vitorino e netos", 1200, 800], ["Tec-sal&pesca", 1300, 1100],
  ["Tec-campoeste", 1200, 800], ["Tec-ahc e vaza", 1200, 800],
  ["Tec-ahc e vaza", 1300, 1100], ["Tec-ahc e vaza", 1300, 1100],
  ["Tec-aduboeste", 1100, 900], ["Tec-Sabino Barbosa", 1200, 800],
  ["Tec-Pedro sabino", 1200, 800], ["Tec-Pedro sabino", 1200, 800],
  ["Tec-Pedro sabino", 1200, 800], ["Tec-Pedro sabino", 1200, 800],
  ["Tec-maravedis", 1100, 900],
];
const unidades = (): PaleteUnidade[] =>
  MEDIDAS.map(([nome, c, l], i) => ({
    pedidoId: i + 1, clienteId: i + 1, clienteNome: nome, tipoPaleteId: 1, tipoPaleteNome: "",
    comprimentoMm: c, larguraMm: l, ordem: i + 1,
  }));

function semSobreposicoes(r: ReturnType<typeof empacotar>) {
  for (const cx of r.caixas) {
    for (const a of cx.itens) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.larguraOcupada).toBeLessThanOrEqual(cx.caixa.larguraMm);
      expect(a.y + a.comprimentoOcupado).toBeLessThanOrEqual(cx.caixa.comprimentoMm);
    }
    for (let i = 0; i < cx.itens.length; i++)
      for (let j = i + 1; j < cx.itens.length; j++) {
        const a = cx.itens[i], b = cx.itens[j];
        const ox = Math.min(a.x + a.larguraOcupada, b.x + b.larguraOcupada) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.comprimentoOcupado, b.y + b.comprimentoOcupado) - Math.max(a.y, b.y);
        expect(ox > 0 && oy > 0).toBe(false);
      }
  }
}

describe("empacotarComRotacoes", () => {
  it("o ponto de partida deixa 1 palete de fora (caso real RIC-Tec-maravedis)", () => {
    expect(empacotar([CAMIAO], unidades()).naoColocados).toHaveLength(1);
  });

  it("rodando paletes já colocadas cabem as 15, sem sobreposições e dentro da caixa", () => {
    const r = empacotarComRotacoes([CAMIAO], unidades());
    expect(r.naoColocados).toHaveLength(0);
    expect(r.colocados).toHaveLength(15);
    semSobreposicoes(r);
  });

  it("não mexe nas paletes nem na ordem: continua a ser a mesma carga", () => {
    const r = empacotarComRotacoes([CAMIAO], unidades());
    expect(r.colocados.map((c) => `${c.clienteNome}|${Math.min(c.comprimentoMm, c.larguraMm)}x${Math.max(c.comprimentoMm, c.larguraMm)}`).sort())
      .toEqual(MEDIDAS.map(([n, c, l]) => `${n}|${Math.min(c, l)}x${Math.max(c, l)}`).sort());
  });

  it("não deixa o índice auxiliar nas paletes devolvidas", () => {
    const r = empacotarComRotacoes([CAMIAO], unidades());
    expect(JSON.stringify(r)).not.toContain("_idx");
  });

  it("sem falhas devolve exatamente o mesmo que empacotar", () => {
    const poucas = unidades().slice(0, 8);
    expect(empacotarComRotacoes([CAMIAO], poucas)).toEqual(empacotar([CAMIAO], poucas));
  });

  it("respeita uma orientação fixada pelo utilizador", () => {
    const us = unidades().map((u, i) => (i === 10 ? { ...u, orientacao: "COMPRIDO" as const } : u));
    const r = empacotarComRotacoes([CAMIAO], us);
    const fixa = r.colocados.find((c) => c.ordem === 11);
    if (fixa) expect(fixa.rotacionado).toBe(false);
  });

  it("carga impossível continua a falhar (não inventa espaço)", () => {
    const muitas = Array.from({ length: 40 }, (_, i) => ({ ...unidades()[0], pedidoId: i + 1, ordem: i + 1, comprimentoMm: 1300, larguraMm: 1100 }));
    const r = empacotarComRotacoes([CAMIAO], muitas);
    expect(r.naoColocados.length).toBeGreaterThan(0);
    semSobreposicoes(r);
  });
});
