import { prisma } from "@/lib/db";

/** Remove acentos/diacríticos (José -> Jose) para um ID limpo. */
function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Iniciais do condutor: 3 primeiras letras do 1.º nome + 2 do 2.º (ex.: "Ricardo
 * Silva" -> "RICSI"). Sem 2.º nome usa só as 3 do 1.º. Fallback no `codigo` de login
 * quando o motorista não tem nome (ex.: escritório -> "ESC").
 */
export function iniciais(nome: string | null | undefined, codigo: string): string {
  const base = semAcentos((nome ?? "").trim() || codigo.trim());
  const partes = base.split(/\s+/).filter(Boolean);
  const primeiro = (partes[0] ?? "").replace(/[^A-Za-z]/g, "").slice(0, 3);
  const segundo = (partes[1] ?? "").replace(/[^A-Za-z]/g, "").slice(0, 2);
  return (primeiro + segundo).toUpperCase();
}

/**
 * Gera um idRota único e legível: `INICIAIS-Cliente`. Se já existir, sufixa com o
 * primeiro inteiro livre (`...2`, `...3`, …). Só é chamado ao iniciar uma rota nova;
 * continuar uma rota reutiliza o idRota existente tal como está.
 */
export async function gerarIdRota(ini: string, cliente: string): Promise<string> {
  const clienteLimpo = cliente.trim().replace(/\s+/g, " ");
  const base = `${ini}-${clienteLimpo}`;

  const existentes = await prisma.paragem.findMany({
    where: { idRota: { startsWith: base } },
    distinct: ["idRota"],
    select: { idRota: true },
  });

  // Só contam os que são exatamente `base` ou `base` + dígitos (evita falsos
  // positivos quando um cliente é prefixo de outro, ex.: "Bot" vs "Boto").
  const escapado = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const padrao = new RegExp(`^${escapado}(\\d+)?$`);
  const usados = new Set(existentes.map((e) => e.idRota).filter((id) => padrao.test(id)));

  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}
