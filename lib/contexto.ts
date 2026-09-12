import { carregarDadosBase } from "@/lib/dados-base";
import { derivarCustos } from "@/lib/calc/params";
import type { ContextoCalculo } from "@/lib/calc/perStop";
import type { ParametrosCusto } from "@/lib/calc/types";

/**
 * Constrói o ContextoCalculo usado pelo motor de cálculo a partir dos dados
 * de configuração "globais" (cacheados em `lib/dados-base.ts` — só mudam via
 * `PUT /api/parametros`). Esta é a ponte entre a camada de dados e a lógica pura.
 */
export async function carregarContexto(): Promise<ContextoCalculo> {
  const { parametros, pneus, consumo, portagens } = await carregarDadosBase();
  const p: ParametrosCusto = parametros;

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
