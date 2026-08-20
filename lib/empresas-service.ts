// Empresas-mãe a quem se cobra grupos de clientes finais (ex.: Tecfil,
// Blowtec) — ver Empresa/Cliente.empresaId em prisma/schema.prisma.

import { prisma } from "@/lib/db";

export interface EmpresaOpt {
  id: number;
  nome: string;
}

export async function listarEmpresas(): Promise<EmpresaOpt[]> {
  return prisma.empresa.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

/** Mapa nome-de-cliente -> nome-da-empresa, para os clientes já classificados. */
export async function mapaClienteEmpresa(): Promise<Map<string, string>> {
  const clientes = await prisma.cliente.findMany({
    where: { empresaId: { not: null } },
    select: { nome: true, empresa: { select: { nome: true } } },
  });
  return new Map(clientes.map((c) => [c.nome, c.empresa!.nome]));
}
