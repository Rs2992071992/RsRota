import { PrismaClient } from "@prisma/client";

// Cliente Prisma como singleton (evita esgotar ligações em dev com hot-reload).
// Esta é a única dependência da camada de dados; a lógica de cálculo (lib/calc)
// não importa daqui.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
