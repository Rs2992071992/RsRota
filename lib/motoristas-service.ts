// Estatísticas por motorista, ano corrente. Ao contrário do custo por
// cliente/rota (rateado por todas as componentes), aqui só interessa a
// componente de custo específica do motorista (salário/km + noites + horas
// extra + alimentação) — usa `efetivos()` do motor de cálculo em vez do
// custo total da rota (combustível/veículo/portagens não são custo do
// motorista).

import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { efetivos } from "@/lib/calc/perStop";
import { paragemToInput, includeRelacoes } from "@/lib/rotas-service";
import { carregarBaseSnapshot } from "@/lib/snapshot-service";

export interface EstatisticasMotorista {
  kmAnoAtual: number;
  /** Kg carregados + descarregados no ano corrente (soma das duas colunas). */
  kgAnoAtual: number;
  horasExtraAnoAtual: number;
  noitesForaAnoAtual: number;
  /** Custo do motorista (salário/km + noites + horas extra + alimentação), ano corrente. */
  custoTotalAnoAtual: number;
}

export async function carregarEstatisticasMotorista(
  motoristaId: number,
): Promise<EstatisticasMotorista> {
  const anoAtual = new Date().getFullYear();
  const inicioAno = new Date(anoAtual, 0, 1);

  const [paragensRaw, ctx, baseSnap] = await Promise.all([
    prisma.paragem.findMany({
      where: { motoristaId, data: { gte: inicioAno } },
      include: includeRelacoes,
    }),
    carregarContexto(),
    carregarBaseSnapshot(),
  ]);

  let kmAnoAtual = 0;
  let kgAnoAtual = 0;
  let horasExtraAnoAtual = 0;
  let noitesForaAnoAtual = 0;
  let custoTotalAnoAtual = 0;

  for (const p of paragensRaw) {
    const input = paragemToInput(p, baseSnap);
    const eff = efetivos(input, ctx);

    kmAnoAtual += p.kmFinal - p.kmInicial;
    kgAnoAtual += p.kgCarregados + p.kgDescarregados;
    horasExtraAnoAtual += p.horasExtra;
    noitesForaAnoAtual += p.noitesFora;
    custoTotalAnoAtual +=
      eff.custoMotoristaPorKm * (p.kmFinal - p.kmInicial) +
      p.noitesFora * eff.valorNoite +
      p.alimentacao +
      p.horasExtra * eff.valorHoraExtra;
  }

  return { kmAnoAtual, kgAnoAtual, horasExtraAnoAtual, noitesForaAnoAtual, custoTotalAnoAtual };
}
