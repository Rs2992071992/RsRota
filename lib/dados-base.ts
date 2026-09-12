import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import type { Parametros, Pneu, TabelaConsumo, TabelaPortagem } from "@prisma/client";

/**
 * Tag de cache para as 4 tabelas de configuração "global": `Parametros`
 * (singleton, id=1), `Pneu`/`TabelaConsumo` globais (`veiculoId: null` —
 * templates/fallback, distintos das tabelas por-veículo geridas em Veículos)
 * e `TabelaPortagem`. Só mudam por um único caminho de escrita
 * (`PUT /api/parametros`, transacional) — por isso um cache indefinido
 * (só invalidado por `revalidateTag`, nunca por tempo) é seguro: nunca fica
 * desatualizado sem que essa rota o invalide explicitamente.
 */
export const TAG_DADOS_BASE = "dados-base";

export interface DadosBase {
  parametros: Parametros;
  pneus: Pneu[];
  consumo: TabelaConsumo[];
  portagens: TabelaPortagem[];
}

/**
 * Antes desta função, `carregarContexto` (4 queries) e `carregarBaseSnapshot`
 * (3 queries) buscavam as MESMAS `Parametros`/`Pneu` global/`TabelaConsumo`
 * global cada uma por si — todas as páginas de rota chamam as duas, dobrando
 * essas 3 queries sem necessidade. Consolidado aqui e cacheado: numa base
 * Neon pooled (`connection_limit=1`, ver tasks/lessons.md 2026-08-13), cada
 * query é sequencial (nunca corre em paralelo, mesmo com `Promise.all`) e o
 * round-trip mediu-se em ~300ms — eliminar queries repetidas por página
 * conta a sério.
 */
const carregarDadosBaseCache = unstable_cache(
  async (): Promise<DadosBase> => {
    const [parametros, pneus, consumo, portagens] = await Promise.all([
      prisma.parametros.findUnique({ where: { id: 1 } }),
      prisma.pneu.findMany({ where: { veiculoId: null }, orderBy: { ordem: "asc" } }),
      prisma.tabelaConsumo.findMany({ where: { veiculoId: null }, orderBy: { cargaKg: "asc" } }),
      prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    ]);
    if (!parametros) {
      throw new Error("Parâmetros não inicializados. Corra `npm run db:seed`.");
    }
    return { parametros, pneus, consumo, portagens };
  },
  ["dados-base"],
  { tags: [TAG_DADOS_BASE] },
);

export async function carregarDadosBase(): Promise<DadosBase> {
  return carregarDadosBaseCache();
}
