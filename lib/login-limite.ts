// Limite de falhas de login por IP (complementa o bloqueio por conta de
// app/api/auth/login/route.ts). Estado na BD (a Vercel é serverless: memória
// de um processo não chega para contar entre pedidos). Falha em aberto: se a BD
// der erro, o login continua a funcionar (o bloqueio por conta mantém-se).

import crypto from "crypto";
import { prisma } from "@/lib/db";

/** Falhas permitidas por IP e janela. Generoso: vários motoristas podem partilhar o mesmo IP móvel. */
export const LIMITE_FALHAS_IP = 30;
export const JANELA_MINUTOS = 15;

interface EstadoIp {
  tentativas: number;
  janelaInicio: Date;
}

/** IP do cliente. Na Vercel `x-forwarded-for` é reescrito pela plataforma (o 1.º valor é o cliente). */
export function ipDoPedido(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return ip || "desconhecido";
}

/** Chave guardada na BD: HMAC do IP (privacidade — nunca o IP em claro). */
export function chaveDoIp(ip: string): string {
  const segredo = process.env.AUTH_SECRET || "dev-secret-troca-em-producao";
  return crypto.createHmac("sha256", segredo).update(`login-ip:${ip}`).digest("hex");
}

const janelaAtiva = (e: EstadoIp, agora: Date) => agora.getTime() - e.janelaInicio.getTime() < JANELA_MINUTOS * 60_000;

/** Está bloqueado agora? (30+ falhas dentro da janela de 15 min.) */
export function avaliarBloqueio(e: EstadoIp | null, agora: Date): { bloqueado: boolean; minutos: number } {
  if (!e || !janelaAtiva(e, agora) || e.tentativas < LIMITE_FALHAS_IP) return { bloqueado: false, minutos: 0 };
  const fim = e.janelaInicio.getTime() + JANELA_MINUTOS * 60_000;
  return { bloqueado: true, minutos: Math.max(1, Math.ceil((fim - agora.getTime()) / 60_000)) };
}

/** Estado depois de mais uma falha: abre janela nova se não havia ou já expirou. */
export function depoisDeFalha(e: EstadoIp | null, agora: Date): EstadoIp {
  if (!e || !janelaAtiva(e, agora)) return { tentativas: 1, janelaInicio: agora };
  return { tentativas: e.tentativas + 1, janelaInicio: e.janelaInicio };
}

export async function ipBloqueado(req: Request, agora = new Date()): Promise<{ bloqueado: boolean; minutos: number }> {
  try {
    const e = await prisma.loginFalha.findUnique({ where: { chave: chaveDoIp(ipDoPedido(req)) } });
    return avaliarBloqueio(e, agora);
  } catch {
    return { bloqueado: false, minutos: 0 };
  }
}

export async function registarFalhaIp(req: Request, agora = new Date()): Promise<void> {
  try {
    const chave = chaveDoIp(ipDoPedido(req));
    const atual = await prisma.loginFalha.findUnique({ where: { chave } });
    const novo = depoisDeFalha(atual, agora);
    await prisma.loginFalha.upsert({
      where: { chave },
      create: { chave, ...novo },
      update: novo,
    });
    // Limpeza oportunista de registos com mais de 1 dia.
    await prisma.loginFalha.deleteMany({ where: { janelaInicio: { lt: new Date(agora.getTime() - 24 * 3600_000) } } });
  } catch {
    // Sem BD não se conta; o login não pode falhar por causa disto.
  }
}
