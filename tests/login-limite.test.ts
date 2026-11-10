import { describe, it, expect, beforeAll } from "vitest";
import { avaliarBloqueio, depoisDeFalha, chaveDoIp, ipDoPedido, LIMITE_FALHAS_IP, JANELA_MINUTOS } from "@/lib/login-limite";

beforeAll(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
});

const T0 = new Date("2026-11-10T12:00:00Z");
const min = (m: number) => new Date(T0.getTime() + m * 60_000);

describe("limite de falhas de login por IP", () => {
  it("sem registo, ou abaixo do limite, não bloqueia", () => {
    expect(avaliarBloqueio(null, T0).bloqueado).toBe(false);
    expect(avaliarBloqueio({ tentativas: LIMITE_FALHAS_IP - 1, janelaInicio: T0 }, min(1)).bloqueado).toBe(false);
  });

  it("no limite, dentro da janela, bloqueia e diz quantos minutos faltam", () => {
    const b = avaliarBloqueio({ tentativas: LIMITE_FALHAS_IP, janelaInicio: T0 }, min(5));
    expect(b.bloqueado).toBe(true);
    expect(b.minutos).toBe(JANELA_MINUTOS - 5);
  });

  it("passada a janela já não bloqueia", () => {
    expect(avaliarBloqueio({ tentativas: 99, janelaInicio: T0 }, min(JANELA_MINUTOS)).bloqueado).toBe(false);
  });

  it("cada falha soma; a janela só se abre na 1.ª e depois de expirar", () => {
    let e = depoisDeFalha(null, T0);
    expect(e).toEqual({ tentativas: 1, janelaInicio: T0 });
    e = depoisDeFalha(e, min(3));
    expect(e).toEqual({ tentativas: 2, janelaInicio: T0 }); // janela mantém-se
    e = depoisDeFalha(e, min(JANELA_MINUTOS + 1)); // expirou → recomeça
    expect(e).toEqual({ tentativas: 1, janelaInicio: min(JANELA_MINUTOS + 1) });
  });

  it("chega ao bloqueio ao fim de LIMITE_FALHAS_IP falhas seguidas", () => {
    let e = null as ReturnType<typeof depoisDeFalha> | null;
    for (let i = 0; i < LIMITE_FALHAS_IP - 1; i++) e = depoisDeFalha(e, min(i % 10));
    expect(avaliarBloqueio(e, min(9)).bloqueado).toBe(false);
    e = depoisDeFalha(e, min(9));
    expect(avaliarBloqueio(e, min(9)).bloqueado).toBe(true);
  });

  it("a chave não contém o IP em claro e é estável por IP", () => {
    const k = chaveDoIp("203.0.113.9");
    expect(k).not.toContain("203.0.113.9");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDoIp("203.0.113.9")).toBe(k);
    expect(chaveDoIp("203.0.113.10")).not.toBe(k);
  });

  it("IP do pedido: 1.º valor de x-forwarded-for, senão x-real-ip, senão 'desconhecido'", () => {
    const r = (h: Record<string, string>) => new Request("http://x/", { headers: h });
    expect(ipDoPedido(r({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe("198.51.100.7");
    expect(ipDoPedido(r({ "x-real-ip": "198.51.100.8" }))).toBe("198.51.100.8");
    expect(ipDoPedido(r({}))).toBe("desconhecido");
  });
});
