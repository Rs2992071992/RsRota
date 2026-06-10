import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionValue, type Perfil, type Sessao } from "@/lib/auth";

/** Lê e valida (HMAC) a sessão completa server-side. Devolve {perfil, id} ou null. */
export function getSessaoInfo(): Sessao | null {
  const value = cookies().get(SESSION_COOKIE)?.value;
  return readSessionValue(value);
}

/** Devolve apenas o perfil (compatibilidade com os call-sites existentes). */
export function getSessao(): Perfil | null {
  return getSessaoInfo()?.perfil ?? null;
}

/** Id do utilizador da sessão (motorista ou escritório), ou null. */
export function getMotoristaId(): number | null {
  return getSessaoInfo()?.id ?? null;
}

/** Exige um perfil específico; redireciona se não autorizado. */
export function exigirPerfil(perfil: Perfil): Perfil {
  const atual = getSessao();
  if (!atual) redirect("/login");
  // Escritório tem acesso a tudo.
  if (atual !== perfil && atual !== "ESCRITORIO") {
    redirect(atual === "MOTORISTA" ? "/motorista/registo" : "/login");
  }
  return atual;
}
