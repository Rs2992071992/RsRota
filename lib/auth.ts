import crypto from "crypto";

export type Perfil = "ESCRITORIO" | "MOTORISTA";

export interface Sessao {
  perfil: Perfil;
  id: number; // id do Utilizador (escritório ou motorista)
}

export const SESSION_COOKIE = "sessao";

// Segredo para assinar a cookie de sessão. Em produção, definir AUTH_SECRET no .env.
const SECRET = process.env.AUTH_SECRET || "dev-secret-troca-em-producao";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Cria o valor assinado da cookie: "<perfil>:<id>.<hmac>". */
export function createSessionValue(perfil: Perfil, id: number): string {
  const payload = `${perfil}:${id}`;
  return `${payload}.${sign(payload)}`;
}

/** Valida o valor da cookie e devolve a sessão, ou null se inválido. */
export function readSessionValue(value: string | undefined): Sessao | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;

  const [perfil, idStr] = payload.split(":");
  const id = Number(idStr);
  if (perfil !== "ESCRITORIO" && perfil !== "MOTORISTA") return null;
  if (!Number.isInteger(id)) return null;
  return { perfil, id };
}
