import { describe, it, expect } from "vitest";
import {
  empacotar,
  estimarQuantosCabem,
  expandirPedidosEmUnidades,
  otimizarOrdem,
  type CaixaInput,
  type PaleteUnidade,
  type PedidoParaExpandir,
} from "@/lib/calc/paletePacking";

// Recria o exemplo do próprio utilizador: camião AO-33-PJ (7500x2480mm),
// Cliente A pede 10x 1300x1100, Cliente B pede 6x 1200x800 (dispara overflow
// -> reboque 8150x2480mm), Cliente C pede 14x 1150x1150.
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

  it("as 10 paletes cabem todas, sem overflow", () => {
    expect(r.colocados).toHaveLength(10);
    expect(r.naoColocados).toHaveLength(0);
  });

  it("arruma 2 por prateleira (5 prateleiras de profundidade 1300)", () => {
    expect(r.caixas[0].prateleiras).toHaveLength(5);
    for (const p of r.caixas[0].prateleiras) {
      expect(p.itens).toHaveLength(2);
      expect(p.profundidadeMm).toBe(1300);
    }
  });
});

describe("empacotar — Cliente A + Cliente B, só no camião (sem reboque)", () => {
  const r = empacotar([CAMIAO], [...clienteA, ...clienteB]);

  it("só cabem 2 das 6 paletes do Cliente B; as outras 4 ficam sem espaço", () => {
    const colocadosB = r.colocados.filter((c) => c.clienteId === 2);
    const naoColocadosB = r.naoColocados.filter((n) => n.unidade.clienteId === 2);
    expect(colocadosB).toHaveLength(2);
    expect(naoColocadosB).toHaveLength(4);
    expect(naoColocadosB.every((n) => n.motivo === "SEM_ESPACO")).toBe(true);
  });

  it("as 10 paletes do Cliente A continuam todas colocadas", () => {
    expect(r.colocados.filter((c) => c.clienteId === 1)).toHaveLength(10);
  });
});

describe("empacotar — com reboque anexado, o overflow do Cliente B é absorvido", () => {
  const r = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB]);

  it("todas as 16 paletes (A+B) ficam colocadas", () => {
    expect(r.colocados).toHaveLength(16);
    expect(r.naoColocados).toHaveLength(0);
  });

  it("2 paletes do Cliente B ficam no camião e 4 no reboque", () => {
    const doB = r.colocados.filter((c) => c.clienteId === 2);
    expect(doB.filter((c) => c.caixaId === "veiculo")).toHaveLength(2);
    expect(doB.filter((c) => c.caixaId === "reboque")).toHaveLength(4);
  });
});

describe("empacotar — Cliente C acrescentado por cima de A+B (estabilidade)", () => {
  const semC = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB]);
  const comC = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB, ...clienteC]);

  it("11 das 14 paletes do Cliente C cabem; 3 ficam sem espaço", () => {
    const colocadosC = comC.colocados.filter((c) => c.clienteId === 3);
    const naoColocadosC = comC.naoColocados.filter((n) => n.unidade.clienteId === 3);
    expect(colocadosC).toHaveLength(11);
    expect(naoColocadosC).toHaveLength(3);
    expect(naoColocadosC.every((n) => n.motivo === "SEM_ESPACO")).toBe(true);
  });

  it("acrescentar o Cliente C não altera a colocação de A+B já feita (append-only)", () => {
    const posicaoAntes = new Map(semC.colocados.map((c) => [`${c.clienteId}-${c.pedidoId}-${c.ordem}`, c]));
    for (const depois of comC.colocados.filter((c) => c.clienteId === 1 || c.clienteId === 2)) {
      const chave = `${depois.clienteId}-${depois.pedidoId}-${depois.ordem}`;
      const antes = posicaoAntes.get(chave);
      expect(antes).toBeDefined();
      expect(depois.caixaId).toBe(antes!.caixaId);
      expect(depois.x).toBe(antes!.x);
      expect(depois.y).toBe(antes!.y);
      expect(depois.rotacionado).toBe(antes!.rotacionado);
    }
  });
});

describe("estimarQuantosCabem", () => {
  it("prevê corretamente quantas 1150x1150 ainda cabem antes de as adicionar", () => {
    const jaColocado = empacotar([CAMIAO, REBOQUE], [...clienteA, ...clienteB]);
    void jaColocado;
    const n = estimarQuantosCabem([CAMIAO, REBOQUE], [...clienteA, ...clienteB], {
      tipoPaleteId: 3,
      tipoPaleteNome: "1150x1150",
      comprimentoMm: 1150,
      larguraMm: 1150,
    });
    expect(n).toBe(11);
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
    expect(r.naoColocados).toHaveLength(1);
    expect(r.naoColocados[0].motivo).toBe("NAO_CABE_ORIENTACAO");
  });

  it("lista de caixas vazia -> tudo sem espaço, sem caixas no resultado", () => {
    const r = empacotar([], clienteA.slice(0, 1));
    expect(r.caixas).toHaveLength(0);
    expect(r.colocados).toHaveLength(0);
    expect(r.naoColocados).toHaveLength(1);
    expect(r.naoColocados[0].motivo).toBe("SEM_ESPACO");
  });

  it("lista de unidades vazia -> nada colocado, caixas vazias reportadas", () => {
    const r = empacotar([CAMIAO], []);
    expect(r.colocados).toHaveLength(0);
    expect(r.naoColocados).toHaveLength(0);
    expect(r.caixas[0].areaUsadaMm2).toBe(0);
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
    // Ordem atual: X (1 palete grande) antes de Y (6 paletes) -> a prateleira do
    // X desperdiça a largura e só cabem 3 do Y. Invertida, cabem os 6 do Y.
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

    const r = otimizarOrdem([caixa], [A, B]);
    expect(r.pedidoIdsOrdenados).toEqual([1, 2]);
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
    const r = otimizarOrdem([caixa], [pedido({ pedidoId: 7, quantidade: 4 })]);
    expect(r.pedidoIdsOrdenados).toEqual([7]);
  });
});

describe("empacotar — orientação preferida por linha (COMPRIDO/TRAVES)", () => {
  // Palete 1300x1100 na caixa 7500x2480. 'TRAVES' = 1300 de largura -> 2 de
  // través não cabem lado a lado (2600 > 2480), mas 1300 + 1100 (rodada) = 2400
  // cabem. O motor deve encostá-las 2 por fila, não 1.
  it("'TRAVES': encosta pares través + comprido em vez de 1 por fila", () => {
    const us = unidades(10, {
      ordemInicial: 1,
      clienteId: 1,
      comprimentoMm: 1300,
      larguraMm: 1100,
      orientacao: "TRAVES",
    });
    const r = empacotar([CAMIAO], us);
    expect(r.colocados).toHaveLength(10);
    expect(r.naoColocados).toHaveLength(0);
    expect(r.caixas[0].prateleiras).toHaveLength(5);
    for (const p of r.caixas[0].prateleiras) {
      expect(p.itens).toHaveLength(2);
      // 1ª da fila na orientação preferida (través = rotacionada), 2ª rodada.
      expect(p.itens[0].rotacionado).toBe(true);
      expect(p.itens[1].rotacionado).toBe(false);
      expect(p.profundidadeMm).toBe(1300);
    }
  });

  it("'COMPRIDO' (1100 de largura): 2 cabem lado a lado sem precisar de rodar", () => {
    const us = unidades(4, {
      ordemInicial: 1,
      clienteId: 1,
      comprimentoMm: 1300,
      larguraMm: 1100,
      orientacao: "COMPRIDO",
    });
    const r = empacotar([CAMIAO], us);
    expect(r.colocados).toHaveLength(4);
    expect(r.colocados.every((c) => c.rotacionado === false)).toBe(true);
  });

  it("orientação preferida que não cabe na largura cai para a alternativa", () => {
    // Caixa 1200 de largura; palete 2000x1000: 'TRAVES' ocuparia 2000 > 1200,
    // 'COMPRIDO' ocupa 1000 <= 1200 -> coloca ao comprido, não fica de fora.
    const caixaEstreita: CaixaInput = {
      id: "veiculo",
      label: "Estreita",
      comprimentoMm: 6000,
      larguraMm: 1200,
    };
    const us = unidades(1, {
      ordemInicial: 1,
      clienteId: 1,
      comprimentoMm: 2000,
      larguraMm: 1000,
      orientacao: "TRAVES",
    });
    const r = empacotar([caixaEstreita], us);
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
    const unidadesGeradas = expandirPedidosEmUnidades([
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
    expect(unidadesGeradas).toHaveLength(3);
    expect(unidadesGeradas.every((u) => u.pedidoId === 1 && u.ordem === 1)).toBe(true);
  });
});
