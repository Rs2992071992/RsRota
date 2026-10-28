// Folha de registo do camião (a folha em papel que alguns clientes pedem):
// por camião e por mês, uma linha por paragem com Dia / Empresa (cliente) /
// Km iniciais / Km finais / % da carga / Gasóleo (L) / Preço / Observações.
// Partilhada pelo PDF, pelo Excel e pela rota API, para os dois formatos
// mostrarem sempre exatamente os mesmos números.

import { carregarBase } from "@/lib/dashboard-service";
import { calcularRotas } from "@/lib/calc/perRoute";
import { linhasCargaParagem, ocupacaoPorParagem } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";
import { mapaClienteEmpresa } from "@/lib/empresas-service";
import type { ParagemCalc } from "@/lib/calc/types";

/** Valor especial do filtro de empresas: clientes ainda sem empresa-mãe atribuída. */
export const SEM_EMPRESA = "__sem_empresa__";

export interface FiltrosFolha {
  /** Inclusivos, "YYYY-MM-DD". Em falta = sem limite. */
  de?: string;
  ate?: string;
  /** Nomes de empresas-mãe (ou SEM_EMPRESA). Vazio/omitido = todas. */
  empresas?: string[];
  veiculoId?: number;
}

export interface LinhaFolha {
  /** Dia do mês (1–31). */
  dia: number;
  /** Nome do cliente da paragem, tal como é registado (ex. "Tec-armazém do norte"). */
  empresa: string;
  kmInicial: number;
  kmFinal: number;
  /** % de ocupação do camião (+ reboque) ao chegar a esta paragem; null = sem caixa configurada. */
  pctCarga: number | null;
  /** Litros de gasóleo (ver `litrosEstimados`). */
  litros: number;
  /** € por litro. */
  preco: number;
  observacoes: string;
}

export interface GrupoFolha {
  /** Camião (nome/matrícula do veículo). */
  camiao: string;
  /** "YYYY-MM". */
  mes: string;
  linhas: LinhaFolha[];
  totalKm: number;
  totalLitros: number;
}

export interface FolhaMotorista {
  grupos: GrupoFolha[];
  /** true se algum valor de litros/preço é estimativa do sistema (nenhum abastecimento registado). */
  litrosEstimados: boolean;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function observacoesDe(p: { idRota: string; tipoVeiculo: string; recolha: boolean }, calc: ParagemCalc): string {
  const partes = [`Rota ${p.idRota}`];
  if (p.tipoVeiculo === "VAZIO") partes.push("vazio");
  else if (p.recolha) partes.push("recolha");
  if (calc.pesoTransportado > 0) partes.push(`${Math.round(calc.pesoTransportado)} kg`);
  return partes.join(" · ");
}

export async function carregarFolha(filtros: FiltrosFolha = {}): Promise<FolhaMotorista> {
  const [base, empresaDoCliente] = await Promise.all([carregarBase(), mapaClienteEmpresa()]);
  const { paragensRaw, ctx, inputs } = base;

  const rotas = calcularRotas(inputs, ctx);
  const calcPorId = new Map<number, ParagemCalc>();
  for (const r of rotas) for (const pc of r.paragens) if (pc.id != null) calcPorId.set(pc.id, pc);

  // % de ocupação por paragem: a simulação é POR ROTA (todas as paragens da
  // rota entram, mesmo as fora do intervalo escolhido), tal como na página da rota.
  const porRota = new Map<string, typeof paragensRaw>();
  for (const p of paragensRaw) {
    const arr = porRota.get(p.idRota) ?? [];
    arr.push(p);
    porRota.set(p.idRota, arr);
  }
  const pctPorParagem = new Map<number, number>();
  for (const ps of porRota.values()) {
    const veic = ps.find((p) => p.tipoVeiculo !== "VAZIO" && p.veiculo)?.veiculo ?? null;
    const caixaVeiculo: CaixaInput[] =
      veic?.caixaComprimentoMm && veic.caixaLarguraMm
        ? [{ id: "veiculo", label: veic.nome, comprimentoMm: veic.caixaComprimentoMm, larguraMm: veic.caixaLarguraMm }]
        : [];
    const caixaReboque: CaixaInput | null = veic?.reboqueHabitual
      ? {
          id: "reboque",
          label: veic.reboqueHabitual.nome,
          comprimentoMm: veic.reboqueHabitual.comprimentoMm,
          larguraMm: veic.reboqueHabitual.larguraMm,
        }
      : null;
    const mapa = ocupacaoPorParagem(
      caixaVeiculo,
      caixaReboque,
      ps.map((p) => ({
        id: p.id,
        ...linhasCargaParagem(p),
        tipoVeiculo: p.tipoVeiculo,
        kmInicial: p.kmInicial,
        cliente: p.cliente,
        faturarCliente: p.faturarCliente,
        tipoViagem: p.tipoViagem,
      })),
    );
    for (const [id, pct] of mapa) pctPorParagem.set(id, pct);
  }

  const empresasSel = new Set(filtros.empresas ?? []);
  const grupos = new Map<string, GrupoFolha>();
  let litrosEstimados = false;

  for (const p of paragensRaw) {
    const dia = ymd(p.data);
    if (filtros.de && dia < filtros.de) continue;
    if (filtros.ate && dia > filtros.ate) continue;
    if (filtros.veiculoId != null && p.veiculoId !== filtros.veiculoId) continue;
    if (empresasSel.size > 0) {
      const mae = empresaDoCliente.get(p.cliente) ?? SEM_EMPRESA;
      if (!empresasSel.has(mae)) continue;
    }

    const calc = calcPorId.get(p.id);
    if (!calc) continue;

    // Abastecimento real, se alguma vez foi registado; senão a estimativa do sistema.
    const real = p.litrosAbastecidos > 0;
    if (!real) litrosEstimados = true;
    const litros = real ? p.litrosAbastecidos : calc.litrosGastos;
    const preco = real ? p.custoAbastecido / p.litrosAbastecidos : calc.precoCombUsado;

    const camiao = p.veiculo?.nome ?? "Sem veículo";
    const mes = dia.slice(0, 7);
    const chave = `${camiao}|${mes}`;
    let g = grupos.get(chave);
    if (!g) {
      g = { camiao, mes, linhas: [], totalKm: 0, totalLitros: 0 };
      grupos.set(chave, g);
    }
    // Um trecho VAZIO é, por definição, sem carga. (A simulação da planta trata a
    // carga do segmento seguinte como "a bordo desde o início do segmento", o que
    // daria uma % > 0 num trecho em que o camião ainda vai vazio a caminho da recolha.)
    const pct = p.tipoVeiculo === "VAZIO" ? 0 : pctPorParagem.get(p.id);
    g.linhas.push({
      dia: p.data.getUTCDate(),
      empresa: p.cliente,
      kmInicial: p.kmInicial,
      kmFinal: p.kmFinal,
      pctCarga: pct == null ? null : pct,
      litros,
      preco,
      observacoes: observacoesDe(p, calc),
    });
    g.totalKm += p.kmFinal - p.kmInicial;
    g.totalLitros += litros;
  }

  const lista = [...grupos.values()].sort((a, b) => a.camiao.localeCompare(b.camiao, "pt") || a.mes.localeCompare(b.mes));
  for (const g of lista) g.linhas.sort((a, b) => a.dia - b.dia || a.kmInicial - b.kmInicial);
  return { grupos: lista, litrosEstimados };
}
