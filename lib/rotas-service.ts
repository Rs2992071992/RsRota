import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { calcularRota, calcularRotas } from "@/lib/calc/perRoute";
import {
  carregarBaseSnapshot,
  snapshotDeEntidades,
  type BaseSnapshot,
} from "@/lib/snapshot-service";
import type { ParagemInput, ParagemSnapshot, RotaCalc } from "@/lib/calc/types";
import type { Paragem, Pneu, Reboque, Utilizador, Veiculo } from "@prisma/client";

/** Paragem com as relações necessárias para resolver o snapshot efetivo. */
type ParagemComRelacoes = Paragem & {
  motorista: Utilizador | null;
  veiculo: (Veiculo & { pneus: Pneu[]; reboqueHabitual: Reboque | null }) | null;
};

/** Include reutilizável para carregar paragens com motorista + veículo (+ pneus + reboque habitual). */
export const includeRelacoes = {
  motorista: true,
  veiculo: {
    include: { pneus: { orderBy: { ordem: "asc" as const } }, reboqueHabitual: true },
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
  const snapshot =
    (p.snapshot as ParagemSnapshot | null) ??
    snapshotDeEntidades(baseSnap, p.motorista, p.veiculo);
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
    pesoAproximado: p.pesoAproximado,
    zonaPortagem: p.zonaPortagem,
    portagensExtra: p.portagensExtra,
    noitesFora: p.noitesFora,
    alimentacao: p.alimentacao,
    horasExtra: p.horasExtra,
    recolha: p.recolha,
    faturarCliente: p.faturarCliente,
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
