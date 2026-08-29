import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionValue, type Perfil, type Sessao } from "@/lib/auth";

/**
 * Lê e valida (HMAC) a sessão completa server-side. Devolve {perfil, id} ou null.
 * Aceita tanto a cookie (browser/WebView, mesma origem) como um token Bearer no
 * header Authorization (apps nativas de origem diferente, ex. Motorista offline)
 * — é o mesmo valor assinado nos dois casos, só muda o transporte.
 *
 * Assíncrona desde o Next.js 15 (`cookies()`/`headers()` passaram a Promise) —
 * todos os call-sites (rotas API, páginas/layouts) já são funções async, por
 * isso só precisaram de ganhar `await` na chamada.
 */
export async function getSessaoInfo(): Promise<Sessao | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const viaToken = readSessionValue(auth.slice(7));
    if (viaToken) return viaToken;
  }
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionValue(value);
}

/** Devolve apenas o perfil (compatibilidade com os call-sites existentes). */
export async function getSessao(): Promise<Perfil | null> {
  return (await getSessaoInfo())?.perfil ?? null;
}

/** Id do utilizador da sessão (motorista ou escritório), ou null. */
export async function getMotoristaId(): Promise<number | null> {
  return (await getSessaoInfo())?.id ?? null;
}

/** Exige um perfil específico; redireciona se não autorizado. */
export async function exigirPerfil(perfil: Perfil): Promise<Perfil> {
  const atual = await getSessao();
  if (!atual) redirect("/login");
  // Escritório tem acesso a tudo.
  if (atual !== perfil && atual !== "ESCRITORIO") {
    redirect(atual === "MOTORISTA" ? "/motorista/registo" : "/login");
  }
  return atual;
}
