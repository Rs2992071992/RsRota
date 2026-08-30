import { describe, it, expect } from "vitest";
import {
  empacotar,
  estimarQuantosCabem,
  expandirPedidosEmUnidades,
  otimizarOrdem,
  type CaixaInput,
  type PaleteColocada,
  type PaleteUnidade,
  type PedidoParaExpandir,
} from "@/lib/calc/paletePacking";

// Camião AO-33-PJ (7500x2480mm), reboque 8150x2480mm.
// Cliente A: 10x 1300x1100, Cliente B: 6x 1200x800, Cliente C: 14x 1150x1150.
const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };
const REBOQUE: CaixaInput = { id: "reboque", label: "Reboque 1", comprimentoMm: 8150, larguraMm: 2480 };

function unidades(
  n: number,
  over: Partial<PaleteUnidade> & { ordemInicial: number },
): PaleteUnidade[] {
  const { ordemInicial, ...base } = over;
  return Array.from({ length: n }, (_, i) => ({
    pedidoId: 0,
    clienteId: 0,
    clienteNome: "",
    tipoPaleteId: 0,
    tipoPaleteNome: "",
    comprimentoMm: 0,
    larguraMm: 0,
    ordem: ordemInicial + i,
    ...base,
  }));
}

/** true se duas paletes colocadas se sobrepõem (não deviam, nunca). */
function sobrepoem(a: PaleteColocada, b: PaleteColocada): boolean {
  if (a.caixaId !== b.caixaId) return false;
  return (
    a.x < b.x + b.larguraOcupada &&
    a.x + a.larguraOcupada > b.x &&
    a.y < b.y + b.comprimentoOcupado &&
    a.y + a.comprimentoOcupado > b.y
  );
}

function semSobreposicoes(colocados: PaleteColocada[]): boolean {
  for (let i = 0; i < colocados.length; i++) {
    for (let j = i + 1; j < colocados.length; j++) {
      if (sobrepoem(colocados[i], colocados[j])) return false;
    }
  }
  return true;
}

const clienteA = unidades(10, {
  ordemInicial: 1,
  clienteId: 1,
  clienteNome: "Cliente A",
  tipoPaleteId: 1,
  tipoPaleteNome: "1300x1100",
  comprimentoMm: 1300,
  larguraMm: 1100,
});

const clienteB = unidades(6, {
  ordemInicial: 11,
  clienteId: 2,
  clienteNome: "Cliente B",
  tipoPaleteId: 2,
  tipoPaleteNome: "1200x800",
  comprimentoMm: 1200,
  larguraMm: 800,
});

const clienteC = unidades(14, {
  ordemInicial: 17,
  clienteId: 3,
  clienteNome: "Cliente C",
  tipoPaleteId: 3,
  tipoPaleteNome: "1150x1150",
  comprimentoMm: 1150,
  larguraMm: 1150,
});

describe("empacotar — Cliente A sozinho (10x 1300x1100 no camião 7500x2480)", () => {
  const r = empacotar([CAMIAO], clienteA);

  it("as 10 paletes cabem todas, sem overflow, sem sobreposições", () => {
    expect(r.colocados).toHaveLength(10);
    expect(r.naoColocados).toHaveLength(0);
    expect(semSobreposicoes(r.colocados)).toBe(true);
  });

  it("usa no máximo ~6600mm de comprimento (2 paletes por faixa)", () => {
    expect(r.caixas[0].itens).toHaveLength(10);
    expect(r.caixas[0].comprimentoUsadoMm).toBeLessThanOrEqual(6600);
    // cada palete dentro dos limites da caixa
    for (const it of r.caixas[0].itens) {
      expect(it.x + it.larguraOcupada).toBeLessThanOrEqual(CAMIAO.larguraMm);
      expect(it.y + it.comprimentoOcupado).toBeLessThanOrEqual(CAMIAO.comprimentoMm);
    }
  });
});

describe("empacotar — 11x 1300x1100 no camião 7500x2480 (caso #9)", () => {
  it("as 11 paletes cabem (faixa de 6 'ao través' + faixa de 5 'ao comprido')", () => {
    const r = empacotar([CAMIAO], unidades(11, { ordemInicial: 1, clienteId: 9, comprimentoMm: 1300, larguraMm: 1100 }));
    expect(r.colocados).toHaveLength(11);
    expect(r.naoColocados).toHaveLength(0);
    expect(semSobreposicoes(r.colocados)).toBe(true);
  });

  it("a 12ª já não cabe", () => {
    const r = empacotar([CAMIAO], unidades(12, { ordemInicial: 1, clienteId: 9, comprimentoMm: 1300, larguraMm: 1100 }));
    expect(r.colocados).toHaveLength(11);
    expect(r.naoColocados).toHaveLength(1);
    expect(r.naoColocados[0].motivo).toBe("SEM_ESPACO");
  });
});

describe("empacotar — Cliente A + Cliente B, só no camião (sem reboque)", () => {
  const r = empacotar([CAMIAO], [...clienteA, ...clienteB]);

  it("cabem as 10 de A + 3 de B; 3 de B ficam sem espaço", () => {
    expect(r.colocados.filter((c) => c.clienteId === 1)).toHaveLength(10);
    expect(r.colocados.filter((c) => c.clienteId === 2)).toHaveLength(3);
    const naoB = r.naoColocados.filter((n) => n.unidade.clienteId === 2);
    expect(naoB).toHaveLength(3);
    expect(naoB.every((n) => n.motivo === "SEM_ESPACO")).toBe(true);
    expect(semSobreposicoes(r.colocados)).toBe(true);
  });
});

describe("empacotar — com reboque anexado, o overflow do Cliente B é absorvido", () => {
  const r = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB]);

  it("todas as 16 paletes (A+B) ficam colocadas", () => {
    expect(r.colocados).toHaveLength(16);
    expect(r.naoColocados).toHaveLength(0);
  });

  it("o Cliente B fica repartido entre camião e reboque", () => {
    const doB = r.colocados.filter((c) => c.clienteId === 2);
    expect(doB.filter((c) => c.caixaId === "veiculo").length).toBeGreaterThan(0);
    expect(doB.filter((c) => c.caixaId === "reboque").length).toBeGreaterThan(0);
    expect(doB).toHaveLength(6);
  });
});

describe("empacotar — Cliente C acrescentado por cima de A+B (estabilidade)", () => {
  const semC = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB]);
  const comC = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB, ...clienteC]);

  it("A e B ficam todos colocados; 3 paletes de C ficam sem espaço", () => {
    expect(comC.colocados.filter((c) => c.clienteId === 1)).toHaveLength(10);
    expect(comC.colocados.filter((c) => c.clienteId === 2)).toHaveLength(6);
    const naoC = comC.naoColocados.filter((n) => n.unidade.clienteId === 3);
    expect(naoC).toHaveLength(3);
    expect(naoC.every((n) => n.motivo === "SEM_ESPACO")).toBe(true);
    expect(semSobreposicoes(comC.colocados)).toBe(true);
  });

  it("acrescentar o Cliente C não altera a colocação de A+B já feita (append-only)", () => {
    const antes = new Map(semC.colocados.map((c) => [`${c.clienteId}-${c.ordem}`, c]));
    for (const depois of comC.colocados.filter((c) => c.clienteId === 1 || c.clienteId === 2)) {
      const a = antes.get(`${depois.clienteId}-${depois.ordem}`);
      expect(a).toBeDefined();
      expect(depois.caixaId).toBe(a!.caixaId);
      expect(depois.x).toBe(a!.x);
      expect(depois.y).toBe(a!.y);
      expect(depois.rotacionado).toBe(a!.rotacionado);
    }
  });
});

describe("estimarQuantosCabem", () => {
  it("prevê quantas 1150x1150 ainda cabem antes de as adicionar", () => {
    const n = estimarQuantosCabem([CAMIAO, REBOQUE], [...clienteA, ...clienteB], {
      tipoPaleteId: 3,
      tipoPaleteNome: "1150x1150",
      comprimentoMm: 1150,
      larguraMm: 1150,
    });
    // igual ao nº de paletes de C que de facto entram quando adicionadas a seguir
    const real = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB, ...clienteC]).colocados.filter(
      (c) => c.clienteId === 3,
    ).length;
    expect(n).toBe(real);
  });
});

describe("empacotar — casos limite", () => {
  it("palete maior que a caixa em qualquer orientação -> NAO_CABE_ORIENTACAO", () => {
    const caixaPequena: CaixaInput = { id: "veiculo", label: "Pequena", comprimentoMm: 2000, larguraMm: 2000 };
    const palete: PaleteUnidade[] = [
      {
        pedidoId: 1,
        clienteId: 1,
        clienteNome: "X",
        tipoPaleteId: 1,
        tipoPaleteNome: "3000x3000",
        comprimentoMm: 3000,
        larguraMm: 3000,
        ordem: 1,
      },
    ];
    const r = empacotar([caixaPequena], palete);
    expect(r.colocados).toHaveLength(0);
    expect(r.naoColocados[0].motivo).toBe("NAO_CABE_ORIENTACAO");
  });

  it("lista de caixas vazia -> tudo sem espaço, sem caixas no resultado", () => {
    const r = empacotar([], clienteA.slice(0, 1));
    expect(r.caixas).toHaveLength(0);
    expect(r.colocados).toHaveLength(0);
    expect(r.naoColocados[0].motivo).toBe("SEM_ESPACO");
  });

  it("lista de unidades vazia -> nada colocado, caixas vazias reportadas", () => {
    const r = empacotar([CAMIAO], []);
    expect(r.colocados).toHaveLength(0);
    expect(r.naoColocados).toHaveLength(0);
    expect(r.caixas[0].areaUsadaMm2).toBe(0);
    expect(r.caixas[0].comprimentoUsadoMm).toBe(0);
  });
});

describe("otimizarOrdem", () => {
  function pedido(over: Partial<PedidoParaExpandir> & { pedidoId: number }): PedidoParaExpandir {
    return {
      clienteId: over.pedidoId,
      clienteNome: `Cliente ${over.pedidoId}`,
      tipoPaleteId: 1,
      tipoPaleteNome: "t",
      comprimentoMm: 1000,
      larguraMm: 1000,
      ordem: over.pedidoId,
      quantidade: 1,
      ...over,
    };
  }

  it("reordena os clientes quando isso faz caber mais paletes", () => {
    const caixa: CaixaInput = { id: "veiculo", label: "C", comprimentoMm: 3000, larguraMm: 2480 };
    const X = pedido({ pedidoId: 1, comprimentoMm: 2400, larguraMm: 1300 });
    const Y = pedido({ pedidoId: 2, comprimentoMm: 1200, larguraMm: 800, quantidade: 6, ordem: 2 });

    const atual = empacotar([caixa], expandirPedidosEmUnidades([X, Y]));
    const r = otimizarOrdem([caixa], [X, Y]);

    expect(r.pedidoIdsOrdenados).toEqual([2, 1]);
    expect(r.packing.naoColocados.length).toBeLessThan(atual.naoColocados.length);
    expect(r.packing.colocados.filter((c) => c.clienteId === 2)).toHaveLength(6);
  });

  it("mantém a ordem atual quando já é a melhor (blocos equivalentes)", () => {
    const caixa: CaixaInput = { id: "veiculo", label: "C", comprimentoMm: 12000, larguraMm: 2480 };
    const A = pedido({ pedidoId: 1, comprimentoMm: 1200, larguraMm: 1000, quantidade: 2 });
    const B = pedido({ pedidoId: 2, comprimentoMm: 1200, larguraMm: 1000, quantidade: 2, ordem: 2 });
    expect(otimizarOrdem([caixa], [A, B]).pedidoIdsOrdenados).toEqual([1, 2]);
  });

  it("com mais de 6 clientes não rebenta e devolve uma permutação dos mesmos pedidos", () => {
    const caixa: CaixaInput = { id: "veiculo", label: "C", comprimentoMm: 20000, larguraMm: 2480 };
    const pedidos = Array.from({ length: 8 }, (_, i) =>
      pedido({ pedidoId: i + 1, ordem: i + 1, comprimentoMm: 1000 + i * 50 }),
    );
    const r = otimizarOrdem([caixa], pedidos);
    expect([...r.pedidoIdsOrdenados].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("1 só linha de pedido -> ordem inalterada", () => {
    const caixa: CaixaInput = { id: "veiculo", label: "C", comprimentoMm: 8000, larguraMm: 2480 };
    expect(otimizarOrdem([caixa], [pedido({ pedidoId: 7, quantidade: 4 })]).pedidoIdsOrdenados).toEqual([7]);
  });
});

describe("empacotar — orientação preferida por linha (COMPRIDO/TRAVES)", () => {
  it("'TRAVES': as 10 paletes 1300x1100 cabem, encostadas com uma rodada", () => {
    const r = empacotar(
      [CAMIAO],
      unidades(10, { ordemInicial: 1, clienteId: 1, comprimentoMm: 1300, larguraMm: 1100, orientacao: "TRAVES" }),
    );
    expect(r.colocados).toHaveLength(10);
    expect(r.naoColocados).toHaveLength(0);
    expect(semSobreposicoes(r.colocados)).toBe(true);
    // há paletes das duas orientações (não ficou tudo "1 por fila")
    expect(r.colocados.some((c) => c.rotacionado)).toBe(true);
    expect(r.colocados.some((c) => !c.rotacionado)).toBe(true);
  });

  it("'COMPRIDO' (1100 de largura): 4 paletes 1300x1100, todas não rodadas", () => {
    const r = empacotar(
      [CAMIAO],
      unidades(4, { ordemInicial: 1, clienteId: 1, comprimentoMm: 1300, larguraMm: 1100, orientacao: "COMPRIDO" }),
    );
    expect(r.colocados).toHaveLength(4);
    expect(r.colocados.every((c) => c.rotacionado === false)).toBe(true);
  });

  it("orientação preferida que não cabe na largura cai para a alternativa", () => {
    const caixaEstreita: CaixaInput = { id: "veiculo", label: "Estreita", comprimentoMm: 6000, larguraMm: 1200 };
    const r = empacotar(
      [caixaEstreita],
      unidades(1, { ordemInicial: 1, clienteId: 1, comprimentoMm: 2000, larguraMm: 1000, orientacao: "TRAVES" }),
    );
    expect(r.colocados).toHaveLength(1);
    expect(r.colocados[0].rotacionado).toBe(false);
  });
});

describe("expandirPedidosEmUnidades", () => {
  it("propaga a orientação forçada para cada unidade", () => {
    const [u] = expandirPedidosEmUnidades([
      {
        pedidoId: 1,
        clienteId: 1,
        clienteNome: "A",
        tipoPaleteId: 1,
        tipoPaleteNome: "t",
        comprimentoMm: 1200,
        larguraMm: 800,
        ordem: 1,
        quantidade: 1,
        orientacao: "TRAVES",
      },
    ]);
    expect(u.orientacao).toBe("TRAVES");
  });

  it("expande a quantidade em unidades individuais, preservando a ordem do pedido", () => {
    const gerado = expandirPedidosEmUnidades([
      {
        pedidoId: 1,
        clienteId: 1,
        clienteNome: "A",
        tipoPaleteId: 1,
        tipoPaleteNome: "1300x1100",
        comprimentoMm: 1300,
        larguraMm: 1100,
        ordem: 1,
        quantidade: 3,
      },
      {
        pedidoId: 2,
        clienteId: 2,
        clienteNome: "B",
        tipoPaleteId: 2,
        tipoPaleteNome: "1200x800",
        comprimentoMm: 1200,
        larguraMm: 800,
        ordem: 2,
        quantidade: 0,
      },
    ]);
    expect(gerado).toHaveLength(3);
    expect(gerado.every((u) => u.pedidoId === 1 && u.ordem === 1)).toBe(true);
  });
});
