import { describe, it, expect } from "vitest";
import { reordenarArrastando } from "@/lib/carregamento-ordem";

const ordem = [10, 20, 30, 40];

describe("reordenarArrastando", () => {
  it("move para a frente (antes de um alvo mais acima)", () => {
    expect(reordenarArrastando(ordem, 30, 10, "antes")).toEqual([30, 10, 20, 40]);
  });

  it("move para trás (depois de um alvo mais abaixo)", () => {
    expect(reordenarArrastando(ordem, 10, 30, "depois")).toEqual([20, 30, 10, 40]);
  });

  it("'antes' de um alvo mais abaixo", () => {
    expect(reordenarArrastando(ordem, 10, 40, "antes")).toEqual([20, 30, 10, 40]);
  });

  it("arrastado === alvo -> inalterado", () => {
    expect(reordenarArrastando(ordem, 20, 20, "antes")).toEqual(ordem);
  });

  it("alvo inexistente -> inalterado", () => {
    expect(reordenarArrastando(ordem, 20, 99, "antes")).toEqual(ordem);
  });

  it("arrastado inexistente -> inalterado", () => {
    expect(reordenarArrastando(ordem, 99, 20, "antes")).toEqual(ordem);
  });

  it("'depois' do último = move para o fim", () => {
    expect(reordenarArrastando(ordem, 10, 40, "depois")).toEqual([20, 30, 40, 10]);
  });
});
