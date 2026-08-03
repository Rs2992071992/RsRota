import { Prisma } from "@prisma/client";

/**
 * Deteta uma violação de FK ao apagar um registo referenciado (onDelete: Restrict).
 * O Postgres nativo lança "restrict_violation" (SQLSTATE 23001), que o Prisma
 * NÃO mapeia para o P2003 conhecido (isso só acontece quando é o próprio motor
 * do Prisma a emular a restrição) — chega como PrismaClientUnknownRequestError
 * genérico. Sem este helper, o catch por `e.code === "P2003"` nunca dispara em
 * Postgres e o pedido rebenta com 500 em vez do erro amigável.
 */
export function ehErroFkRestricao(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") return true;
  if (e instanceof Prisma.PrismaClientUnknownRequestError) {
    return /23001|23503|restrict_violation|foreign key/i.test(e.message);
  }
  return false;
}
