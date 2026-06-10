import { prisma } from "@/lib/db";
import { derivarCustos } from "@/lib/calc/params";
import type { ContextoCalculo } from "@/lib/calc/perStop";
import type { ParametrosCusto } from "@/lib/calc/types";

/**
 * Carrega parâmetros e tabelas da BD e constrói o ContextoCalculo usado pelo
 * motor de cálculo. Esta é a ponte entre a camada de dados e a lógica pura.
 */
export async function carregarContexto(): Promise<ContextoCalculo> {
  const [params, pneus, consumo, portagens] = await Promise.all([
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.pneu.findMany({ orderBy: { ordem: "asc" } }),
    prisma.tabelaConsumo.findMany({ orderBy: { cargaKg: "asc" } }),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
  ]);

  if (!params) {
    throw new Error("Parâmetros não inicializados. Corra `npm run db:seed`.");
  }

  const p: ParametrosCusto = params;

  return {
    params: p,
    derivados: derivarCustos(
      p,
      pneus.map((t) => ({ custo: t.custo, km: t.km })),
    ),
    tabelaConsumo: consumo.map((c) => ({ cargaKg: c.cargaKg, consumoL100: c.consumoL100 })),
    tabelaPortagens: portagens.map((t) => ({ zona: t.zona, valor: t.valor })),
  };
}
