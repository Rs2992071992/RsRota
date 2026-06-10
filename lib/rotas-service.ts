import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { calcularRota, calcularRotas } from "@/lib/calc/perRoute";
import type { ParagemInput, RotaCalc } from "@/lib/calc/types";
import type { Paragem } from "@prisma/client";

export interface FiltrosRota {
  de?: Date;
  ate?: Date;
  cliente?: string;
  tipoVeiculo?: string;
  /** "lucro" | "prejuizo" | undefined */
  estado?: string;
}

/** Converte um registo Paragem da BD no input do motor de cálculo. */
export function paragemToInput(p: Paragem): ParagemInput {
  return {
    id: p.id,
    idRota: p.idRota,
    data: p.data,
    cliente: p.cliente,
    tipoViagem: p.tipoViagem,
    tipoVeiculo: p.tipoVeiculo,
    kmInicial: p.kmInicial,
    kmFinal: p.kmFinal,
    kgCarregados: p.kgCarregados,
    kgDescarregados: p.kgDescarregados,
    zonaPortagem: p.zonaPortagem,
    portagensExtra: p.portagensExtra,
    noitesFora: p.noitesFora,
    alimentacao: p.alimentacao,
    horasExtra: p.horasExtra,
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

  const [paragens, ctx] = await Promise.all([
    prisma.paragem.findMany({ where, orderBy: { data: "asc" } }),
    carregarContexto(),
  ]);

  let rotas = calcularRotas(paragens.map(paragemToInput), ctx);

  if (filtros.estado === "prejuizo") rotas = rotas.filter((r) => r.lucro < 0);
  if (filtros.estado === "lucro") rotas = rotas.filter((r) => r.lucro >= 0);

  return rotas.sort((a, b) => a.lucro - b.lucro);
}

/** Calcula uma única rota pelo seu ID (para a página de detalhe). */
export async function carregarRota(idRota: string): Promise<{
  rota: RotaCalc | null;
  paragensRaw: Paragem[];
}> {
  const [paragensRaw, ctx] = await Promise.all([
    prisma.paragem.findMany({ where: { idRota }, orderBy: { data: "asc" } }),
    carregarContexto(),
  ]);
  if (paragensRaw.length === 0) return { rota: null, paragensRaw: [] };
  const rota = calcularRota(idRota, paragensRaw.map(paragemToInput), ctx);
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
