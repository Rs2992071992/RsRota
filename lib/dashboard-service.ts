import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { calcularParagem } from "@/lib/calc/perStop";
import { calcularRotas } from "@/lib/calc/perRoute";
import { valorPortagem } from "@/lib/calc/lookups";
import type { RotaCalc } from "@/lib/calc/types";
import { paragemToInput, includeRelacoes } from "@/lib/rotas-service";
import { carregarBaseSnapshot } from "@/lib/snapshot-service";

export interface DespesaPorRota {
  idRota: string;
  data: Date;
  combustivel: number;
  motorista: number;
  veiculo: number;
  portagens: number;
  adblue: number;
  extras: number;
  total: number;
}

export interface DashboardData {
  kpis: {
    nRotas: number;
    kmTotais: number;
    custoTotal: number;
    receitaTotal: number;
    lucroTotal: number;
    margemMedia: number; // %
    nPrejuizo: number;
  };
  rankingMenosRentaveis: { idRota: string; lucro: number; custo: number; receita: number }[];
  custoVsReceita: { idRota: string; custo: number; receita: number }[];
  porCliente: { cliente: string; custo: number; receita: number; lucro: number }[];
  evolucaoMensal: { mes: string; custo: number; receita: number; lucro: number }[];
  estruturaCustos: { nome: string; valor: number }[];
}

/** Base partilhada: paragens + contexto + inputs com snapshot efetivo. */
async function carregarBase() {
  const [paragensRaw, ctx, baseSnap] = await Promise.all([
    prisma.paragem.findMany({ orderBy: { data: "asc" }, include: includeRelacoes }),
    carregarContexto(),
    carregarBaseSnapshot(),
  ]);
  const inputs = paragensRaw.map((p) => paragemToInput(p, baseSnap));
  return { paragensRaw, ctx, inputs };
}

/**
 * Estrutura de custos discriminada por rota (soma das 6 categorias = estruturaCustos).
 * Deriva de `RotaCalc` (não recalcula por paragem) para herdar o `pesoEmTransito`
 * já aplicado por `calcularRotas` — Σ total desta função = Σ `custoTotalRota` (KPI).
 */
function despesasPorRota(rotas: RotaCalc[]): DespesaPorRota[] {
  return rotas.map((r) => {
    const combustivel = r.paragens.reduce((a, p) => a + p.custoCombustivel, 0);
    const motorista = r.paragens.reduce((a, p) => a + p.custoMotorista, 0);
    const veiculo = r.paragens.reduce((a, p) => a + p.custoVeiculo, 0);
    const adblue = r.paragens.reduce((a, p) => a + p.custoAdblue, 0);
    const portagens = r.paragens.reduce((a, p) => a + p.portagensExtra, 0) + r.somaPortagensTabela;
    const extras = r.somaNoites + r.somaAlimentacao + r.somaHorasExtraValor;
    return {
      idRota: r.idRota,
      data: r.dataInicio,
      combustivel,
      motorista,
      veiculo,
      portagens,
      adblue,
      extras,
      total: combustivel + motorista + veiculo + portagens + adblue + extras,
    };
  });
}

/** Página de detalhe da "Estrutura de custos" — todas as rotas, discriminadas por categoria. */
export async function carregarDespesasDetalhe(): Promise<DespesaPorRota[]> {
  const { ctx, inputs } = await carregarBase();
  return despesasPorRota(calcularRotas(inputs, ctx));
}

export interface PoupancaEspanhaDia {
  idRota: string;
  cliente: string;
  data: Date;
  litros: number;
  custoEspanha: number;
  precoCombRef: number;
  poupanca: number;
}

export interface PoupancaEspanhaMes {
  mes: string; // "YYYY-MM"
  litros: number;
  poupanca: number;
}

export interface PoupancaEspanhaData {
  porDia: PoupancaEspanhaDia[];
  porMes: PoupancaEspanhaMes[];
  litrosTotal: number;
  totalGeral: number;
  totalUltimos12Meses: number;
}

/**
 * Poupança de combustível abastecido em Espanha vs. preço de referência —
 * puramente informativo (já assim no motor: `poupancaEspanha` nunca entra em
 * nenhum custo/rateio). Esta função só agrega o que `calcularParagem` já
 * devolve por paragem; não introduz nenhuma fórmula nova.
 */
export async function carregarPoupancaEspanha(): Promise<PoupancaEspanhaData> {
  const { paragensRaw, ctx, inputs } = await carregarBase();

  const porDia: PoupancaEspanhaDia[] = [];
  for (let i = 0; i < paragensRaw.length; i++) {
    const p = paragensRaw[i];
    if (!p.litrosEspanha || p.litrosEspanha <= 0) continue;
    const calc = calcularParagem(inputs[i], ctx);
    porDia.push({
      idRota: p.idRota,
      cliente: p.cliente,
      data: p.data,
      litros: calc.litrosEspanha,
      custoEspanha: p.custoEspanha || 0,
      // Preço efetivamente usado nesta rota (override da rota, se existir,
      // senão o de Parâmetros) — o mesmo que calc.poupancaEspanha já usa,
      // para a coluna "preço ref" bater sempre com a poupança ao lado.
      precoCombRef: calc.precoCombUsado,
      poupanca: calc.poupancaEspanha,
    });
  }
  porDia.sort((a, b) => b.data.getTime() - a.data.getTime());

  const porMesMap = new Map<string, { litros: number; poupanca: number }>();
  for (const d of porDia) {
    const mes = `${d.data.getFullYear()}-${String(d.data.getMonth() + 1).padStart(2, "0")}`;
    const at = porMesMap.get(mes) ?? { litros: 0, poupanca: 0 };
    at.litros += d.litros;
    at.poupanca += d.poupanca;
    porMesMap.set(mes, at);
  }
  const porMes = Array.from(porMesMap.entries())
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => b.mes.localeCompare(a.mes));

  const litrosTotal = porDia.reduce((a, d) => a + d.litros, 0);
  const totalGeral = porDia.reduce((a, d) => a + d.poupanca, 0);
  const ha12Meses = new Date();
  ha12Meses.setMonth(ha12Meses.getMonth() - 12);
  const totalUltimos12Meses = porDia
    .filter((d) => d.data >= ha12Meses)
    .reduce((a, d) => a + d.poupanca, 0);

  return { porDia, porMes, litrosTotal, totalGeral, totalUltimos12Meses };
}

export async function carregarDashboard(): Promise<DashboardData> {
  const { paragensRaw, ctx, inputs } = await carregarBase();
  const rotas = calcularRotas(inputs, ctx);

  // KPIs
  const custoTotal = rotas.reduce((a, r) => a + r.custoTotalRota, 0);
  const receitaTotal = rotas.reduce((a, r) => a + r.receitaTotal, 0);
  const lucroTotal = receitaTotal - custoTotal;
  const kmTotais = rotas.reduce((a, r) => a + r.kmTotais, 0);
  const nPrejuizo = rotas.filter((r) => r.lucro < 0).length;
  // Margem média: média das margens % das rotas com receita.
  const margens = rotas
    .filter((r) => r.receitaTotal > 0)
    .map((r) => (r.lucro / r.receitaTotal) * 100);
  const margemMedia = margens.length ? margens.reduce((a, b) => a + b, 0) / margens.length : 0;

  // Ranking menos rentáveis (já vêm ordenadas por lucro asc do calcularRotas? não — aqui ordenamos)
  const ordenadas = [...rotas].sort((a, b) => a.lucro - b.lucro);
  const rankingMenosRentaveis = ordenadas.slice(0, 10).map((r) => ({
    idRota: r.idRota,
    lucro: r.lucro,
    custo: r.custoTotalRota,
    receita: r.receitaTotal,
  }));

  const custoVsReceita = rotas.map((r) => ({
    idRota: r.idRota,
    custo: r.custoTotalRota,
    receita: r.receitaTotal,
  }));

  // Por cliente (agrega rateio de todas as rotas)
  const cli = new Map<string, { custo: number; receita: number }>();
  for (const r of rotas) {
    for (const c of r.rateio) {
      const at = cli.get(c.cliente) ?? { custo: 0, receita: 0 };
      at.custo += c.custoAtribuido;
      at.receita += c.receitaPaga;
      cli.set(c.cliente, at);
    }
  }
  const porCliente = Array.from(cli.entries())
    .map(([cliente, v]) => ({ cliente, custo: v.custo, receita: v.receita, lucro: v.receita - v.custo }))
    .sort((a, b) => a.lucro - b.lucro);

  // Evolução mensal (por paragem, somando todas as componentes de custo + receita)
  const mensal = new Map<string, { custo: number; receita: number }>();
  for (let i = 0; i < paragensRaw.length; i++) {
    const p = paragensRaw[i];
    const calc = calcularParagem(inputs[i], ctx);
    const portagem = valorPortagem(p.zonaPortagem, ctx.tabelaPortagens).valor;
    const custo =
      calc.custoParagem +
      p.noitesFora +
      p.alimentacao +
      p.horasExtra * ctx.params.valorHoraExtra +
      portagem;
    const d = new Date(p.data);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const at = mensal.get(mes) ?? { custo: 0, receita: 0 };
    at.custo += custo;
    at.receita += p.receitaPaga;
    mensal.set(mes, at);
  }
  const evolucaoMensal = Array.from(mensal.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, custo: v.custo, receita: v.receita, lucro: v.receita - v.custo }));

  // Estrutura de custos (agregada sobre todas as rotas — mesma base da página de detalhe).
  const porRota = despesasPorRota(rotas);
  const combustivel = porRota.reduce((a, r) => a + r.combustivel, 0);
  const motorista = porRota.reduce((a, r) => a + r.motorista, 0);
  const veiculo = porRota.reduce((a, r) => a + r.veiculo, 0);
  const adblue = porRota.reduce((a, r) => a + r.adblue, 0);
  const portagens = porRota.reduce((a, r) => a + r.portagens, 0);
  const extras = porRota.reduce((a, r) => a + r.extras, 0);
  const estruturaCustos = [
    { nome: "Combustível", valor: combustivel },
    { nome: "Motorista", valor: motorista },
    { nome: "Veículo", valor: veiculo },
    { nome: "Portagens", valor: portagens },
    { nome: "AdBlue", valor: adblue },
    { nome: "Noites/Alim./Horas", valor: extras },
  ].filter((e) => e.valor > 0);

  return {
    kpis: {
      nRotas: rotas.length,
      kmTotais,
      custoTotal,
      receitaTotal,
      lucroTotal,
      margemMedia,
      nPrejuizo,
    },
    rankingMenosRentaveis,
    custoVsReceita,
    porCliente,
    evolucaoMensal,
    estruturaCustos,
  };
}
