import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { calcularRota, calcularRotas } from "@/lib/calc/perRoute";
import {
  carregarBaseSnapshot,
  snapshotDeEntidades,
  type BaseSnapshot,
} from "@/lib/snapshot-service";
import type {
  PaleteLinha,
  ParagemInput,
  ParagemSnapshot,
  RateioManualItem,
  RotaCalc,
} from "@/lib/calc/types";
import type { Paragem, Pneu, Reboque, TabelaConsumo, Utilizador, Veiculo } from "@prisma/client";

/** Paragem com as relações necessárias para resolver o snapshot efetivo. */
type ParagemComRelacoes = Paragem & {
  motorista: Utilizador | null;
  veiculo:
    | (Veiculo & { pneus: Pneu[]; reboqueHabitual: Reboque | null; consumoTabela: TabelaConsumo[] })
    | null;
};

/** Include reutilizável para carregar paragens com motorista + veículo (+ pneus + reboque habitual + consumo). */
export const includeRelacoes = {
  motorista: true,
  veiculo: {
    include: {
      pneus: { orderBy: { ordem: "asc" as const } },
      reboqueHabitual: true,
      consumoTabela: { orderBy: { cargaKg: "asc" as const } },
    },
  },
};

/**
 * Resolve as dimensões (mm) de um TipoPalete do catálogo, para congelar numa
 * Paragem no momento do registo (`paleteComprimentoMm`/`LarguraMm`) — nunca uma
 * referência viva: se o catálogo mudar depois, esta paragem já registada não
 * é afetada (mesmo princípio do resto do snapshot congelado).
 */
export async function resolverPaleteDimensoes(
  tipoPaleteId: number | null | undefined,
): Promise<{ paleteComprimentoMm: number | null; paleteLarguraMm: number | null }> {
  if (!tipoPaleteId) return { paleteComprimentoMm: null, paleteLarguraMm: null };
  const tipo = await prisma.tipoPalete.findUnique({ where: { id: tipoPaleteId } });
  if (!tipo) return { paleteComprimentoMm: null, paleteLarguraMm: null };
  return { paleteComprimentoMm: tipo.comprimentoMm, paleteLarguraMm: tipo.larguraMm };
}

/**
 * Resolve várias linhas de palete (tamanhos diferentes na mesma paragem),
 * congelando as dimensões de cada `tipoPaleteId` — ver `Paragem.paletes`.
 * Linhas com `tipoPaleteId` desconhecido ou `nPaletes <= 0` são descartadas.
 * Devolve `null` quando não há linhas válidas (a paragem fica de linha única).
 */
export async function resolverPaleteDimensoesMuitas(
  linhas: { tipoPaleteId: number; nPaletes: number; sentido?: "ENTREGA" | "RECOLHA" }[] | undefined,
): Promise<PaleteLinha[] | null> {
  if (!linhas || linhas.length === 0) return null;
  const ids = Array.from(new Set(linhas.map((l) => l.tipoPaleteId)));
  const tipos = await prisma.tipoPalete.findMany({ where: { id: { in: ids } } });
  const porId = new Map(tipos.map((t) => [t.id, t]));
  const resolvidas: PaleteLinha[] = [];
  for (const l of linhas) {
    const t = porId.get(l.tipoPaleteId);
    if (!t || !(l.nPaletes > 0)) continue;
    resolvidas.push({
      tipoPaleteId: t.id,
      comprimentoMm: t.comprimentoMm,
      larguraMm: t.larguraMm,
      nPaletes: l.nPaletes,
      ...(l.sentido ? { sentido: l.sentido } : {}),
    });
  }
  return resolvidas.length > 0 ? resolvidas : null;
}

export interface FiltrosRota {
  de?: Date;
  ate?: Date;
  cliente?: string;
  tipoVeiculo?: string;
  /** "lucro" | "prejuizo" | undefined */
  estado?: string;
}

/**
 * Converte um registo Paragem da BD no input do motor. O snapshot efetivo é:
 * (1) o snapshot congelado em BD, se existir; senão (2) calculado a partir do
 * motorista + veículo da paragem; senão (3) defaults globais (legado/importado).
 */
export function paragemToInput(p: ParagemComRelacoes, baseSnap: BaseSnapshot): ParagemInput {
  const frozen = p.snapshot as ParagemSnapshot | null;
  let snapshot: ParagemSnapshot;
  if (frozen) {
    // A caixa de carga (mm) e o fator de ocupação são factos físicos do veículo,
    // não custos a congelar — snapshots antigos (congelados antes destes campos
    // existirem, ou antes de o veículo ter medidas) não os têm, e sem eles a
    // capacidade de paletes por dimensão dá 0 → coeficiente 0 → rateio parte-se.
    // Preenche a partir do veículo atual quando faltam (mesmo princípio da
    // lição de 2026-08-22 para capacidadePaleteA/B).
    snapshot = {
      ...frozen,
      caixaComprimentoMm: frozen.caixaComprimentoMm ?? p.veiculo?.caixaComprimentoMm ?? null,
      caixaLarguraMm: frozen.caixaLarguraMm ?? p.veiculo?.caixaLarguraMm ?? null,
      caixaReboqueComprimentoMm:
        frozen.caixaReboqueComprimentoMm ?? p.veiculo?.reboqueHabitual?.comprimentoMm ?? null,
      caixaReboqueLarguraMm:
        frozen.caixaReboqueLarguraMm ?? p.veiculo?.reboqueHabitual?.larguraMm ?? null,
      fatorOcupacaoPalete: frozen.fatorOcupacaoPalete ?? p.veiculo?.fatorOcupacaoPalete ?? 1,
    };
  } else {
    snapshot = snapshotDeEntidades(baseSnap, p.motorista, p.veiculo);
  }
  return {
    id: p.id,
    snapshot,
    idRota: p.idRota,
    data: p.data,
    cliente: p.cliente,
    tipoViagem: p.tipoViagem,
    tipoVeiculo: p.tipoVeiculo,
    kmInicial: p.kmInicial,
    kmFinal: p.kmFinal,
    kgCarregados: p.kgCarregados,
    kgDescarregados: p.kgDescarregados,
    volume: p.volume,
    tipoPalete: p.tipoPalete,
    nPaletes: p.nPaletes,
    nMeiasPaletes: p.nMeiasPaletes,
    tipoPaleteId: p.tipoPaleteId,
    paleteComprimentoMm: p.paleteComprimentoMm,
    paleteLarguraMm: p.paleteLarguraMm,
    paletes: Array.isArray(p.paletes) ? (p.paletes as unknown as PaleteLinha[]) : null,
    pesoAproximado: p.pesoAproximado,
    pesoAproximadoCarregado: p.pesoAproximadoCarregado,
    zonaPortagem: p.zonaPortagem,
    portagensExtra: p.portagensExtra,
    noitesFora: p.noitesFora,
    alimentacao: p.alimentacao,
    horasExtra: p.horasExtra,
    recolha: p.recolha,
    faturarCliente: p.faturarCliente,
    faturarClienteApenasRecolha: p.faturarClienteApenasRecolha,
    rateioManual: p.rateioManual as RateioManualItem[] | null,
    precoCombRefOverride: p.precoCombRefOverride,
    receitaPaga: p.receitaPaga,
    litrosEspanha: p.litrosEspanha,
    custoEspanha: p.custoEspanha,
  };
}

/**
 * Carrega paragens (com filtros de data/cliente/veículo), calcula as rotas e
 * aplica o filtro de estado (lucro/prejuízo). Devolve rotas ordenadas por
 * lucro ascendente (as mais problemáticas primeiro).
 */
export async function carregarRotas(filtros: FiltrosRota = {}): Promise<RotaCalc[]> {
  const where: Record<string, unknown> = {};
  if (filtros.de || filtros.ate) {
    where.data = {
      ...(filtros.de ? { gte: filtros.de } : {}),
      ...(filtros.ate ? { lte: filtros.ate } : {}),
    };
  }
  if (filtros.cliente) where.cliente = filtros.cliente;
  if (filtros.tipoVeiculo) where.tipoVeiculo = filtros.tipoVeiculo;

  const [paragens, ctx, baseSnap] = await Promise.all([
    prisma.paragem.findMany({ where, orderBy: { data: "asc" }, include: includeRelacoes }),
    carregarContexto(),
    carregarBaseSnapshot(),
  ]);

  let rotas = calcularRotas(
    paragens.map((p) => paragemToInput(p, baseSnap)),
    ctx,
  );

  if (filtros.estado === "prejuizo") rotas = rotas.filter((r) => r.lucro < 0);
  if (filtros.estado === "lucro") rotas = rotas.filter((r) => r.lucro >= 0);

  return rotas.sort((a, b) => a.lucro - b.lucro);
}

/** Calcula uma única rota pelo seu ID (para a página de detalhe). */
export async function carregarRota(idRota: string): Promise<{
  rota: RotaCalc | null;
  paragensRaw: ParagemComRelacoes[];
}> {
  const [paragensRaw, ctx, baseSnap] = await Promise.all([
    // Ordenado por KM (sequência real da rota: cliente A km 100-200, cliente
    // B km 200-300, ...), não por data — várias paragens podem partilhar a
    // mesma data e a ordem de introdução não é necessariamente a da estrada.
    prisma.paragem.findMany({
      where: { idRota },
      orderBy: [{ kmInicial: "asc" }, { id: "asc" }],
      include: includeRelacoes,
    }),
    carregarContexto(),
    carregarBaseSnapshot(),
  ]);
  if (paragensRaw.length === 0) return { rota: null, paragensRaw: [] };
  const rota = calcularRota(
    idRota,
    paragensRaw.map((p) => paragemToInput(p, baseSnap)),
    ctx,
  );
  return { rota, paragensRaw };
}

/** Listas auxiliares para filtros. */
export async function opcoesFiltro() {
  const paragens = await prisma.paragem.findMany({
    select: { cliente: true, tipoVeiculo: true },
  });
  const clientes = Array.from(new Set(paragens.map((p) => p.cliente))).sort();
  const tiposVeiculo = Array.from(new Set(paragens.map((p) => p.tipoVeiculo))).sort();
  return { clientes, tiposVeiculo };
}
