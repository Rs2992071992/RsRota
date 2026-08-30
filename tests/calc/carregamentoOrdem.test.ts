import { describe, it, expect } from "vitest";
import { moverBlocoCliente, type PedidoOrdenavel } from "@/lib/carregamento-ordem";

// A=cliente 1, B=cliente 2, C=cliente 3
const abc: PedidoOrdenavel[] = [
  { pedidoId: 10, clienteId: 1 },
  { pedidoId: 20, clienteId: 2 },
  { pedidoId: 30, clienteId: 3 },
];

describe("moverBlocoCliente", () => {
  it("move um bloco para cima", () => {
    expect(moverBlocoCliente(abc, 2, "cima")).toEqual([20, 10, 30]);
  });

  it("move um bloco para baixo", () => {
    expect(moverBlocoCliente(abc, 2, "baixo")).toEqual([10, 30, 20]);
  });

  it("no topo, 'cima' não faz nada", () => {
    expect(moverBlocoCliente(abc, 1, "cima")).toEqual([10, 20, 30]);
  });

  it("no fundo, 'baixo' não faz nada", () => {
    expect(moverBlocoCliente(abc, 3, "baixo")).toEqual([10, 20, 30]);
  });

  it("cliente inexistente -> ordem inalterada", () => {
    expect(moverBlocoCliente(abc, 99, "cima")).toEqual([10, 20, 30]);
  });

  it("reagrupa pedidos do mesmo cliente que estavam dispersos", () => {
    const disperso: PedidoOrdenavel[] = [
      { pedidoId: 1, clienteId: 1 },
      { pedidoId: 2, clienteId: 2 },
      { pedidoId: 3, clienteId: 1 },
    ];
    // Blocos: A=[1,3], B=[2], ordem [A, B]. Mover B para cima -> [B, A].
    expect(moverBlocoCliente(disperso, 2, "cima")).toEqual([2, 1, 3]);
  });
});
