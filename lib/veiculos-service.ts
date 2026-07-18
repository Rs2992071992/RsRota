// Estatísticas por veículo. Ao contrário do custo por cliente (rateado por
// rota), `Paragem.veiculoId` é uma associação direta — não precisa do motor
// de cálculo, só de uma agregação simples sobre as paragens do veículo.

import { prisma } from "@/lib/db";

const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface EstatisticasVeiculo {
  cargasEfetuadas: number;
  clientesAtendidos: number;
  /** Kg carregados + descarregados no ano corrente (soma das duas colunas). */
  kgAnoAtual: number;
  /** Kg carregados + descarregados por mês do ano corrente, Jan–Dez (0 nos meses sem movimento). */
  serieMensalAnoAtual: { mes: string; kg: number }[];
}

export async function carregarEstatisticasVeiculo(veiculoId: number): Promise<EstatisticasVeiculo> {
  const paragens = await prisma.paragem.findMany({
    where: { veiculoId },
    select: { cliente: true, kgCarregados: true, kgDescarregados: true, data: true },
  });

  const anoAtual = new Date().getFullYear();
  const cargasEfetuadas = paragens.filter((p) => p.kgCarregados > 0).length;
  const clientesAtendidos = new Set(paragens.map((p) => p.cliente)).size;

  const doAno = paragens.filter((p) => p.data.getFullYear() === anoAtual);
  const kgAnoAtual = doAno.reduce((a, p) => a + p.kgCarregados + p.kgDescarregados, 0);

  const porMes = new Array(12).fill(0);
  for (const p of doAno) porMes[p.data.getMonth()] += p.kgCarregados + p.kgDescarregados;
  const serieMensalAnoAtual = NOMES_MES.map((mes, i) => ({ mes, kg: porMes[i] }));

  return { cargasEfetuadas, clientesAtendidos, kgAnoAtual, serieMensalAnoAtual };
}
