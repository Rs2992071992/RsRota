import { describe, it, expect } from "vitest";
import {
  verificarEspacoCarga,
  gerarPlantaCargaRota,
  linhasCargaParagem,
  type LinhaCarga,
  type ParagemCarga,
} from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque", comprimentoMm: 8150, larguraMm: 2480 };
// 1300×1100: cabem 10 no camião sozinho, 12 no reboque.
const P1300: Omit<LinhaCarga, "nPaletes"> = { tipoPaleteId: 1, comprimentoMm: 1300, larguraMm: 1100 };

/** Atalho: paragem de entrega pura (tudo a bordo desde o início do segmento). */
function entrega(nPaletes: number, kmInicial: number, tipoVeiculo = "CAMIAO"): ParagemCarga {
  return {
    entregues: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: "E" }] : [],
    recolhidas: [],
    tipoVeiculo,
    kmInicial,
  };
}

/** Atalho: paragem de recolha pura (entra aqui, fica a bordo). */
function recolha(nPaletes: number, kmInicial: number): ParagemCarga {
  return {
    entregues: [],
    recolhidas: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: "R" }] : [],
    tipoVeiculo: "CAMIAO",
    kmInicial,
  };
}

/** Atalho: paragem mista (descarrega umas, carrega outras). */
function mista(nEntregues: number, nRecolhidas: number, kmInicial: number): ParagemCarga {
  return {
    entregues: nEntregues > 0 ? [{ ...P1300, nPaletes: nEntregues, clienteNome: "M" }] : [],
    recolhidas: nRecolhidas > 0 ? [{ ...P1300, nPaletes: nRecolhidas, clienteNome: "M" }] : [],
    tipoVeiculo: "CAMIAO",
    kmInicial,
  };
}

/** Atalho: troço VAZIO (fronteira de segmento). */
function vazio(kmInicial: number): ParagemCarga {
  return { entregues: [], recolhidas: [], tipoVeiculo: "VAZIO", kmInicial };
}

describe("verificarEspacoCarga — simulação da ocupação ao longo da rota", () => {
  it("entrega única que cabe → cabemTodas", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(6, 0)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.verificavel).toBe(true);
    expect(r.totalPaletes).toBe(6);
  });

  it("entregas puras que não cabem → avisa (comportamento de sempre)", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(8, 0), entrega(8, 50)]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(16); // as 16 estão a bordo desde o início
    expect(r.colocadas + r.semEspaco).toBe(16);
  });

  it("reboque anexado absorve o overflow de entregas", () => {
    const r = verificarEspacoCarga([CAMIAO, REBOQUE], [entrega(8, 0), entrega(8, 50)]);
    expect(r.cabemTodas).toBe(true);
  });

  it("entregar 10 (enche) e SÓ DEPOIS recolher 10 → pico 10, cabe", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(10, 0), recolha(10, 100)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(10); // nunca houve 20 a bordo
  });

  it("entrega + recolha sobrepostas: o pico é um estado misto", () => {
    // ordem por km: entrega6@0, recolha6@50, entrega6@100
    const r = verificarEspacoCarga([CAMIAO], [entrega(6, 0), recolha(6, 50), entrega(6, 100)]);
    // estado após a recolha: entrega6@100 (ainda a bordo) + recolha6@50 = 12
    // paletes a bordo ao mesmo tempo — mais do que cabem no camião.
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12); // pico misto, não a soma (18) nem 6
    expect(r.semEspaco).toBeGreaterThan(0);
  });

  it("VAZIO corta em segmentos que nunca coexistem", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(10, 0), vazio(50), recolha(10, 100)]);
    expect(r.cabemTodas).toBe(true); // 10 num segmento, 10 no outro
  });

  it("segmento só de recolhas que não cabe → avisa", () => {
    const r = verificarEspacoCarga([CAMIAO], [recolha(12, 0)]);
    expect(r.cabemTodas).toBe(false);
    expect(r.totalPaletes).toBe(12);
  });

  it("sem caixas → não verificável, não avisa", () => {
    const r = verificarEspacoCarga([], [entrega(999, 0)]);
    expect(r.verificavel).toBe(false);
    expect(r.cabemTodas).toBe(true);
  });

  it("rota sem paletes → verificável, cabe (nada)", () => {
    const r = verificarEspacoCarga([CAMIAO], [entrega(0, 0)]);
    expect(r.verificavel).toBe(true);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(0);
  });

  it("tamanhos diferentes entre entrega e recolha", () => {
    const r = verificarEspacoCarga(
      [CAMIAO],
      [
        { entregues: [{ tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 }], recolhidas: [], tipoVeiculo: "CAMIAO", kmInicial: 0 },
        { entregues: [], recolhidas: [{ tipoPaleteId: 2, comprimentoMm: 1150, larguraMm: 1150, nPaletes: 3 }], tipoVeiculo: "CAMIAO", kmInicial: 100 },
      ],
    );
    expect(r.cabemTodas).toBe(true);
  });

  it("paragem mista: descarrega 6 + carrega 4 no mesmo stop → pico não é a soma", () => {
    // Antes de mais nada a bordo: 6 (entregues aqui). Depois: 4 (recolhidas aqui).
    const r = verificarEspacoCarga([CAMIAO], [mista(6, 4, 0)]);
    expect(r.cabemTodas).toBe(true);
    expect(r.totalPaletes).toBe(6); // pico = max(6, 4), nunca 10
  });

  it("paragem mista no meio de uma rota: pico é o estado antes/depois do sítio misto", () => {
    // entrega3@0, mista(descarrega 2, carrega 8)@50
    const r = verificarEspacoCarga([CAMIAO], [entrega(3, 0), mista(2, 8, 50)]);
    // Início do segmento: 3 (entrega0) + 2 (entregues da mista) = 5 a bordo.
    // Entre as 2 paragens: só os 2 da mista (a de 3 já saiu) = 2.
    // Fim: as 8 carregadas na mista ficam a bordo = 8. Pico = 8, nunca 3+2+8=13.
    expect(r.totalPaletes).toBe(8);
    expect(r.cabemTodas).toBe(true);
  });

  describe("recolha entregue mais tarde (faturarCliente) — não conta a dobra", () => {
    /** Recolha para outro cliente: fica a bordo até à entrega desse cliente. */
    function recolhaPara(nPaletes: number, kmInicial: number, faturarCliente: string): ParagemCarga {
      return {
        entregues: [],
        recolhidas: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: "Fornecedor" }] : [],
        tipoVeiculo: "CAMIAO+REBOQUE",
        kmInicial,
        cliente: "Fornecedor",
        faturarCliente,
      };
    }
    function entregaCliente(nPaletes: number, kmInicial: number, cliente: string): ParagemCarga {
      return {
        entregues: nPaletes > 0 ? [{ ...P1300, nPaletes, clienteNome: cliente }] : [],
        recolhidas: [],
        tipoVeiculo: "CAMIAO+REBOQUE",
        kmInicial,
        cliente,
      };
    }
    const CAMIAO_REBOQUE = { id: "veiculo", label: "V", comprimentoMm: 7300, larguraMm: 2480 };
    const REBOQUE2 = { id: "reboque", label: "R", comprimentoMm: 7500, larguraMm: 2480 };

    it("cenário real (Ida entrega 16, recolhe 4 p/ Cliente A; Volta recolhe 10 p/ Cliente B, entrega tudo) → pico 16, não 30", () => {
      const ida = [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => entregaCliente(2, i * 50, `Cliente ${n}`));
      const paragens: ParagemCarga[] = [
        ...ida,
        recolhaPara(2, 400, "Cliente A"),
        recolhaPara(2, 430, "Cliente A"),
        recolhaPara(4, 650, "Cliente B"),
        recolhaPara(3, 700, "Cliente B"),
        recolhaPara(3, 750, "Cliente B"),
        entregaCliente(4, 800, "Cliente A"),
        entregaCliente(10, 800, "Cliente B"),
      ];
      const r = verificarEspacoCarga([CAMIAO_REBOQUE, REBOQUE2], paragens);
      expect(r.totalPaletes).toBe(16); // pico real: as 8 entregas da ida, todas a bordo
    });

    it("sem faturarCliente (recolha comum): fica presa ao seu próprio segmento — comportamento de sempre", () => {
      // Mesmo cenário, mas a recolha da ida NÃO tem faturarCliente -> não é
      // uma "linha", fica a bordo até ao fim do SEU segmento (sem VAZIO,
      // é o mesmo segmento da entrega final -> ainda conta a dobra, como
      // sempre contou; a correção só se aplica quando há faturarCliente).
      const semLinha: ParagemCarga = {
        entregues: [],
        recolhidas: [{ ...P1300, nPaletes: 2, clienteNome: "Fornecedor" }],
        tipoVeiculo: "CAMIAO",
        kmInicial: 400,
      };
      const r = verificarEspacoCarga(
        [CAMIAO_REBOQUE, REBOQUE2],
        [entrega(10, 0), semLinha, entregaCliente(2, 800, "Cliente X")],
      );
      // entrega10 (índice0) + entregaCliente2 (índice2) contam-se ambas desde
      // o início do segmento (comportamento herdado, não é o que este teste
      // corrige) -> pico >= 12, mesmo sem nada de novo ter sido apanhado.
      expect(r.totalPaletes).toBeGreaterThanOrEqual(12);
    });

    it("VAZIO entre a recolha e a entrega: a carga da linha atravessa, o resto continua a cortar", () => {
      const paragens: ParagemCarga[] = [
        entrega(6, 0),
        recolhaPara(4, 50, "Cliente A"),
        { entregues: [], recolhidas: [], tipoVeiculo: "VAZIO", kmInicial: 100 },
        entrega(5, 150, "CAMIAO+REBOQUE"), // novo segmento, sem relação com a linha
        entregaCliente(4, 200, "Cliente A"),
      ];
      const r = verificarEspacoCarga([CAMIAO_REBOQUE, REBOQUE2], paragens);
      // 1º segmento: pico 6 (entrega) — a recolha (4, linha) não se soma aqui.
      // 2º segmento isolado: pico 5 (entrega) + 4 (linha ainda a bordo) = 9,
      // depois cai para 4 (só a linha) até à entrega final.
      expect(r.totalPaletes).toBe(9);
    });

    it("2 entregas para o mesmo alvo: só a 1ª fecha a linha (limitação assumida)", () => {
      const paragens: ParagemCarga[] = [
        recolhaPara(5, 0, "Cliente A"),
        entregaCliente(3, 50, "Cliente A"),
        entregaCliente(2, 100, "Cliente A"),
      ];
      const r = verificarEspacoCarga([CAMIAO_REBOQUE, REBOQUE2], paragens);
      // Fecha na 1ª entrega (índice1): a 2ª entrega (índice2) já não tem
      // nenhuma carga de linha "aberta" para si -> conta como entrega normal,
      // fora de qualquer linha (segmento próprio, a bordo desde o início dele).
      // Pico: os 5 da linha (recolhidos em 0, entregues em 1) coexistem com
      // os 2 da 2ª entrega (a bordo desde antes dela) = 7.
      expect(r.totalPaletes).toBe(7);
      expect(r.cabemTodas).toBe(true);
    });
  });
});

describe("linhasCargaParagem", () => {
  it("mesma paragem com 2 tamanhos → 2 linhas de entregues", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4 },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 2 },
      ],
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      nPaletes: 6,
      cliente: "Cli",
    });
    expect(entregues).toHaveLength(2);
    expect(recolhidas).toHaveLength(0);
    expect(entregues.reduce((s, l) => s + l.nPaletes, 0)).toBe(6);
  });

  it("linhas com sentido RECOLHA vão para `recolhidas`", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: [
        { tipoPaleteId: 1, comprimentoMm: 1200, larguraMm: 800, nPaletes: 4, sentido: "ENTREGA" },
        { tipoPaleteId: 2, comprimentoMm: 1200, larguraMm: 1000, nPaletes: 3, sentido: "RECOLHA" },
      ],
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      nPaletes: 7,
      recolha: true,
      cliente: "Cli",
    });
    expect(entregues.reduce((s, l) => s + l.nPaletes, 0)).toBe(4);
    expect(recolhidas.reduce((s, l) => s + l.nPaletes, 0)).toBe(3);
  });

  it("paragem de linha única (só escalares) → 1 linha em entregues", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes: 12,
      cliente: "Cli",
    });
    expect(recolhidas).toHaveLength(0);
    expect(entregues).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 12, clienteNome: "Cli" },
    ]);
  });

  it("paragem de linha única com `recolha: true` (sem sentido explícito) → vai para recolhidas", () => {
    const { entregues, recolhidas } = linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes: 12,
      recolha: true,
      cliente: "Cli",
    });
    expect(entregues).toHaveLength(0);
    expect(recolhidas).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 12, clienteNome: "Cli" },
    ]);
  });

  const escalar = (nPaletes: number, nMeiasPaletes: number) =>
    linhasCargaParagem({
      paletes: null,
      paleteComprimentoMm: 1200,
      paleteLarguraMm: 800,
      tipoPalete: null,
      tipoPaleteId: 5,
      nPaletes,
      nMeiasPaletes,
      cliente: "Cli",
    }).entregues;

  it("só 1 meia-palete (0 inteiras) → 1 lugar", () => {
    expect(escalar(0, 1).reduce((s, l) => s + l.nPaletes, 0)).toBe(1);
  });

  it("4 meias soltas → 2 lugares (2 por lugar)", () => {
    expect(escalar(0, 4).reduce((s, l) => s + l.nPaletes, 0)).toBe(2);
  });

  it("meias que cabem em cima das bases não ocupam chão", () => {
    expect(escalar(5, 3)).toEqual([
      { tipoPaleteId: 5, comprimentoMm: 1200, larguraMm: 800, nPaletes: 5, clienteNome: "Cli" },
    ]);
  });

  it("bases 5 + 9 meias → 5 + ceil((9-5)/2)=2 = linha extra de 2", () => {
    const r = escalar(5, 9);
    expect(r).toHaveLength(2);
    expect(r.reduce((s, l) => s + l.nPaletes, 0)).toBe(7);
  });
});

describe("gerarPlantaCargaRota — planta (geometria) do pior momento da rota", () => {
  it("sem caixa configurada → null", () => {
    expect(gerarPlantaCargaRota([], [entrega(6, 0)])).toBeNull();
  });

  it("nada a bordo em rota nenhuma → null", () => {
    expect(gerarPlantaCargaRota([CAMIAO], [entrega(0, 0)])).toBeNull();
  });

  it("entrega única que cabe → devolve a geometria com todas colocadas", () => {
    const p = gerarPlantaCargaRota([CAMIAO], [entrega(6, 0)]);
    expect(p).not.toBeNull();
    expect(p!.colocados).toHaveLength(6);
    expect(p!.naoColocados).toHaveLength(0);
    expect(p!.caixas[0].itens).toHaveLength(6);
  });

  it("mesmo pior momento que verificarEspacoCarga (recolha fica a bordo, entrega depois)", () => {
    const paragens = [recolha(4, 0), entrega(4, 50)];
    const espaco = verificarEspacoCarga([CAMIAO], paragens);
    const p = gerarPlantaCargaRota([CAMIAO], paragens);
    expect(p).not.toBeNull();
    expect(p!.colocados.length + p!.naoColocados.length).toBe(espaco.totalPaletes);
    expect(p!.naoColocados).toHaveLength(espaco.semEspaco);
  });

  it("pior momento com paletes a mais → naoColocados reflete o mesmo semEspaco", () => {
    const paragens = [entrega(8, 0), entrega(8, 50)];
    const espaco = verificarEspacoCarga([CAMIAO], paragens);
    const p = gerarPlantaCargaRota([CAMIAO], paragens);
    expect(espaco.cabemTodas).toBe(false);
    expect(p!.naoColocados).toHaveLength(espaco.semEspaco);
  });
});
