import { describe, it, expect } from "vitest";
import { estadoPagamento, PRAZO_DIAS } from "@/lib/calc/pagamentos";

const HOJE = new Date("2026-06-10T12:00:00Z");

describe("estadoPagamento — prazo de 90 dias", () => {
  it("pago → PAGO independentemente da data", () => {
    const antiga = new Date("2025-01-01T00:00:00Z"); // muito além dos 90 dias
    const r = estadoPagamento(antiga, true, HOJE);
    expect(r.estado).toBe("PAGO");
  });

  it("não pago e dentro do prazo → A_AGUARDAR com dias restantes positivos", () => {
    const data = new Date("2026-05-01T00:00:00Z"); // vence 30/07/2026
    const r = estadoPagamento(data, false, HOJE);
    expect(r.estado).toBe("A_AGUARDAR");
    expect(r.diasRestantes).toBeGreaterThan(0);
  });

  it("não pago e fora do prazo → VENCIDO com dias negativos", () => {
    const data = new Date("2026-01-01T00:00:00Z"); // vence 01/04/2026, já passou
    const r = estadoPagamento(data, false, HOJE);
    expect(r.estado).toBe("VENCIDO");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("dataVencimento = data + 90 dias", () => {
    const data = new Date("2026-03-12T00:00:00Z");
    const r = estadoPagamento(data, false, HOJE);
    const esperado = new Date(data.getTime() + PRAZO_DIAS * 24 * 60 * 60 * 1000);
    expect(r.dataVencimento.getTime()).toBe(esperado.getTime());
  });

  it("bordo exato: hoje == vencimento ainda é A_AGUARDAR (0 dias)", () => {
    const data = new Date("2026-03-12T12:00:00Z");
    const venc = new Date(data.getTime() + PRAZO_DIAS * 24 * 60 * 60 * 1000);
    const r = estadoPagamento(data, false, venc);
    expect(r.estado).toBe("A_AGUARDAR");
    expect(r.diasRestantes).toBe(0);
  });

  it("aceita data em string ISO", () => {
    const r = estadoPagamento("2026-01-01", false, HOJE);
    expect(r.estado).toBe("VENCIDO");
  });
});
