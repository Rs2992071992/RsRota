// Estatísticas por veículo. Ao contrário do custo por cliente (rateado por
// rota), `Paragem.veiculoId` é uma associação direta — não precisa do motor
// de cálculo, só de uma agregação simples sobre as paragens do veículo.

import { prisma } from "@/lib/db";
import { linhasPaleteEfetivas, pesoAproximadoDescarregado, pesoAproximadoCarregadoEfetivo } from "@/lib/calc/perStop";
import type { PaleteLinha } from "@/lib/calc/types";

const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface EstatisticasVeiculo {
  cargasEfetuadas: number;
  clientesAtendidos: number;
  /** Kg carregados + descarregados no ano corrente — soma os 2 estilos de
   * rota (nunca se sobrepõem numa mesma paragem): kg legado (modo "kg"
   * manual, pré-2026-08-28) + peso aproximado (rotas por paletes, ver
   * `lib/calc/perStop.ts::pesoAproximadoDescarregado`/`pesoAproximadoCarregadoEfetivo`). */
  kgAnoAtual: number;
  /** Paletes transportadas no ano corrente (recolha faturada a outro cliente com entrega na mesma rota não conta a dobra). */
  paletesAnoAtual: number;
  /** Kg carregados + descarregados por mês do ano corrente, Jan–Dez (0 nos meses sem movimento). */
  serieMensalAnoAtual: { mes: string; kg: number }[];
  /** Paletes por mês do ano corrente, Jan–Dez (0 nos meses sem movimento). */
  serieMensalPaletesAnoAtual: { mes: string; paletes: number }[];
}

type ParagemVeiculo = {
  idRota: string;
  cliente: string;
  tipoVeiculo: string;
  faturarCliente: string | null;
  kgCarregados: number;
  kgDescarregados: number;
  nPaletes: number;
  nMeiasPaletes: number;
  volume: boolean;
  tipoPaleteId: number | null;
  paleteComprimentoMm: number | null;
  paleteLarguraMm: number | null;
  paletes: PaleteLinha[] | null;
  pesoAproximado: number | null;
  pesoAproximadoCarregado: number | null;
  recolha: boolean;
  data: Date;
};

/** Nº de paletes de uma paragem (0,5 por meia-palete), cobrindo os 2 estilos: legado (volume/tipoPalete) e novo (dimensão própria). */
function nPaletesParagem(p: ParagemVeiculo): number {
  const linhas = linhasPaleteEfetivas(p);
  const ehPaleteLegado = p.volume || p.tipoVeiculo === "PALETE_120X80" || p.tipoVeiculo === "PALETE_120X100";
  if (linhas.length === 0 && !ehPaleteLegado) return 0;
  const nBase = linhas.length > 0 ? linhas.reduce((s, l) => s + (l.nPaletes || 0), 0) : p.nPaletes || 0;
  return nBase + (p.nMeiasPaletes || 0) * 0.5;
}

/**
 * Índices de paragens cujo peso/paletes já foram contados na entrega desse
 * mesmo lote, dentro da mesma rota (mesma regra de `lib/calc/perRoute.ts`
 * `totalPaletes`/`totalPesoAproximado`): uma recolha faturada a outro
 * cliente (`faturarCliente`) que também tem entrega nessa rota não deve
 * somar-se de novo — senão o lote conta-se duas vezes (recolha + entrega).
 * Aplicado por rota porque a ligação recolha→entrega só faz sentido dentro
 * da mesma viagem.
 */
function indicesJaContadosNaEntrega(paragens: ParagemVeiculo[]): Set<number> {
  const porRota = new Map<string, number[]>();
  paragens.forEach((p, i) => {
    if (!porRota.has(p.idRota)) porRota.set(p.idRota, []);
    porRota.get(p.idRota)!.push(i);
  });

  const jaContada = new Set<number>();
  for (const indices of porRota.values()) {
    const clientesComEntrega = new Set(
      indices
        .filter((i) => paragens[i].tipoVeiculo !== "VAZIO")
        .map((i) => paragens[i].cliente?.trim())
        .filter((x): x is string => !!x),
    );
    for (const i of indices) {
      const p = paragens[i];
      if (p.tipoVeiculo === "VAZIO") continue;
      const alvo = p.faturarCliente?.trim();
      if (alvo && clientesComEntrega.has(alvo)) jaContada.add(i);
    }
  }
  return jaContada;
}

export async function carregarEstatisticasVeiculo(veiculoId: number): Promise<EstatisticasVeiculo> {
  const paragens: ParagemVeiculo[] = (
    await prisma.paragem.findMany({
      where: { veiculoId },
      select: {
        idRota: true,
        cliente: true,
        tipoVeiculo: true,
        faturarCliente: true,
        kgCarregados: true,
        kgDescarregados: true,
        nPaletes: true,
        nMeiasPaletes: true,
        volume: true,
        tipoPaleteId: true,
        paleteComprimentoMm: true,
        paleteLarguraMm: true,
        paletes: true,
        pesoAproximado: true,
        pesoAproximadoCarregado: true,
        recolha: true,
        data: true,
      },
    })
  ).map((p) => ({ ...p, paletes: Array.isArray(p.paletes) ? (p.paletes as unknown as PaleteLinha[]) : null }));

  const jaContadaNaEntrega = indicesJaContadosNaEntrega(paragens);

  const anoAtual = new Date().getFullYear();
  const cargasEfetuadas = paragens.filter((p) => p.kgCarregados > 0 || nPaletesParagem(p) > 0).length;
  const clientesAtendidos = new Set(
    paragens.filter((p) => p.tipoVeiculo !== "VAZIO").map((p) => p.cliente),
  ).size;

  let kgAnoAtual = 0;
  let paletesAnoAtual = 0;
  const porMesKg = new Array(12).fill(0);
  const porMesPaletes = new Array(12).fill(0);
  paragens.forEach((p, i) => {
    if (p.data.getFullYear() !== anoAtual) return;
    if (jaContadaNaEntrega.has(i)) return; // recolha faturada a outro cliente com entrega na mesma rota — já contada lá
    const mes = p.data.getMonth();
    const kg =
      p.kgCarregados + p.kgDescarregados + pesoAproximadoDescarregado(p) + pesoAproximadoCarregadoEfetivo(p);
    kgAnoAtual += kg;
    porMesKg[mes] += kg;
    const nPal = nPaletesParagem(p);
    paletesAnoAtual += nPal;
    porMesPaletes[mes] += nPal;
  });
  const serieMensalAnoAtual = NOMES_MES.map((mes, i) => ({ mes, kg: porMesKg[i] }));
  const serieMensalPaletesAnoAtual = NOMES_MES.map((mes, i) => ({ mes, paletes: porMesPaletes[i] }));

  return {
    cargasEfetuadas,
    clientesAtendidos,
    kgAnoAtual,
    paletesAnoAtual,
    serieMensalAnoAtual,
    serieMensalPaletesAnoAtual,
  };
}
