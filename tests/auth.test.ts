import { beforeAll, describe, expect, it } from "vitest";
import { createSessionValue, readSessionValue, TTL_COOKIE_SEG } from "@/lib/auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "segredo-de-teste";
});

const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);

describe("sessão assinada", () => {
  it("aceita um token válido e devolve perfil, id e versão", () => {
    const v = createSessionValue("MOTORISTA", 7, 3, TTL_COOKIE_SEG, T0);
    expect(readSessionValue(v, T0 + 1000)).toEqual({ perfil: "MOTORISTA", id: 7, versao: 3 });
  });

  it("recusa o token depois de expirar", () => {
    const v = createSessionValue("MOTORISTA", 7, 0, 60, T0);
    expect(readSessionValue(v, T0 + 59_000)).not.toBeNull();
    expect(readSessionValue(v, T0 + 60_000)).toBeNull();
  });

  it("recusa um token adulterado (perfil, id, validade ou versão)", () => {
    const v = createSessionValue("MOTORISTA", 7, 0, 60, T0);
    const [payload, sig] = [v.slice(0, v.lastIndexOf(".")), v.slice(v.lastIndexOf(".") + 1)];
    const partes = payload.split(":");
    const adulterar = (i: number, valor: string) =>
      [...partes.slice(0, i), valor, ...partes.slice(i + 1)].join(":") + "." + sig;
    expect(readSessionValue(adulterar(0, "ESCRITORIO"), T0)).toBeNull();
    expect(readSessionValue(adulterar(1, "1"), T0)).toBeNull();
    expect(readSessionValue(adulterar(2, String(Number(partes[2]) + 99999)), T0)).toBeNull();
    expect(readSessionValue(adulterar(3, "1"), T0)).toBeNull();
  });

  it("recusa o formato antigo sem validade", () => {
    // "<perfil>:<id>.<hmac>" assinado com o mesmo segredo — já não vale.
    const crypto = require("crypto") as typeof import("crypto");
    const payload = "ESCRITORIO:1";
    const sig = crypto.createHmac("sha256", "segredo-de-teste").update(payload).digest("hex");
    expect(readSessionValue(`${payload}.${sig}`, T0)).toBeNull();
  });

  it("recusa lixo e valores vazios", () => {
    expect(readSessionValue(undefined)).toBeNull();
    expect(readSessionValue("")).toBeNull();
    expect(readSessionValue("abc")).toBeNull();
    expect(readSessionValue("MOTORISTA:1:9999999999:0.zzz")).toBeNull();
  });
});
