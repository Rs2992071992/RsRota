import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, readSessionValue, type Perfil, type Sessao } from "@/lib/auth";

/**
 * A assinatura e a validade já foram verificadas; falta confirmar na BD que o
 * utilizador ainda existe, tem este perfil e que o PIN não mudou desde que o
 * token foi emitido (versão). Em cache por pedido: layouts e páginas chamam
 * getSessaoInfo várias vezes e só deve haver uma consulta.
 */
const utilizadorValido = cache(async (id: number, perfil: Perfil, versao: number) => {
  const u = await prisma.utilizador.findUnique({
    where: { id },
    select: { perfil: true, sessaoVersao: true },
  });
  return !!u && u.perfil === perfil && u.sessaoVersao === versao;
});

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
  let assinada = null;
  if (auth?.startsWith("Bearer ")) assinada = readSessionValue(auth.slice(7));
  if (!assinada) assinada = readSessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  if (!assinada) return null;
  if (!(await utilizadorValido(assinada.id, assinada.perfil, assinada.versao))) return null;
  return { perfil: assinada.perfil, id: assinada.id };
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
