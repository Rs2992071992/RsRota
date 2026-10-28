import crypto from "crypto";

export type Perfil = "ESCRITORIO" | "MOTORISTA";

export interface Sessao {
  perfil: Perfil;
  id: number; // id do Utilizador (escritório ou motorista)
}

/** Sessão tal como vem assinada no token: inclui a versão a comparar com a BD. */
export interface SessaoAssinada extends Sessao {
  versao: number;
}

/** Validade do cookie do site (renova-se ao fazer login). */
export const TTL_COOKIE_SEG = 60 * 60 * 12; // 12 horas
/** Validade do token da app Android (longa: o motorista trabalha offline). */
export const TTL_TOKEN_APP_SEG = 60 * 60 * 24 * 90; // 90 dias

export const SESSION_COOKIE = "sessao";

// Segredo para assinar a cookie de sessão. Em produção, definir AUTH_SECRET no .env.
const SECRET_DEV = "dev-secret-troca-em-producao";

/**
 * Em produção, exige AUTH_SECRET definido — o valor de dev é público (está no
 * código-fonte no GitHub), por isso cair nele em produção deixaria qualquer
 * pessoa forjar sessões válidas. Lido a cada chamada (não ao carregar o
 * módulo) para nunca impedir o build, que corre com NODE_ENV=production sem
 * chegar a assinar nada.
 */
function segredo(): string {
  const valor = process.env.AUTH_SECRET;
  if (valor) return valor;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET não está definido em produção. Definir esta variável de ambiente " +
        "antes de assinar ou validar qualquer sessão — ver .env.example.",
    );
  }
  return SECRET_DEV;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", segredo()).update(value).digest("hex");
}

/**
 * Cria o valor assinado da sessão: "<perfil>:<id>:<expira>:<versao>.<hmac>",
 * com `expira` em segundos unix. Sem validade embutida, um token copiado
 * funcionaria para sempre.
 */
export function createSessionValue(
  perfil: Perfil,
  id: number,
  versao: number,
  ttlSeg: number,
  agoraMs: number = Date.now(),
): string {
  const expira = Math.floor(agoraMs / 1000) + ttlSeg;
  const payload = `${perfil}:${id}:${expira}:${versao}`;
  return `${payload}.${sign(payload)}`;
}

/** Valida o valor da cookie e devolve a sessão, ou null se inválido. */
export function readSessionValue(value: string | undefined, agoraMs: number = Date.now()): SessaoAssinada | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!payload || !sig) return null;

  // Comparação em tempo constante — evita dar pistas sobre a assinatura
  // correta através da diferença de tempo de resposta.
  const esperado = Buffer.from(sign(payload), "utf8");
  const recebido = Buffer.from(sig, "utf8");
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) {
    return null;
  }

  // Formato antigo (sem validade) tem só 2 partes e é recusado de propósito.
  const partes = payload.split(":");
  if (partes.length !== 4) return null;
  const [perfil, idStr, expiraStr, versaoStr] = partes;
  const id = Number(idStr);
  const expira = Number(expiraStr);
  const versao = Number(versaoStr);
  if (perfil !== "ESCRITORIO" && perfil !== "MOTORISTA") return null;
  if (!Number.isInteger(id) || !Number.isInteger(expira) || !Number.isInteger(versao)) return null;
  if (expira * 1000 <= agoraMs) return null;
  return { perfil, id, versao };
}
