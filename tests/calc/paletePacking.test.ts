import { describe, it, expect } from "vitest";
import {
  empacotar,
  estimarQuantosCabem,
  expandirPedidosEmUnidades,
  type CaixaInput,
  type PaleteUnidade,
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

describe("expandirPedidosEmUnidades", () => {
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
