import { prisma } from "@/lib/db";
import { carregarContexto } from "@/lib/contexto";
import { calcularParagem } from "@/lib/calc/perStop";
import { calcularRotas } from "@/lib/calc/perRoute";
import { valorPortagem } from "@/lib/calc/lookups";
import { paragemToInput } from "@/lib/rotas-service";

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

export async function carregarDashboard(): Promise<DashboardData> {
  const [paragensRaw, ctx] = await Promise.all([
    prisma.paragem.findMany({ orderBy: { data: "asc" } }),
    carregarContexto(),
  ]);

  const inputs = paragensRaw.map(paragemToInput);
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
  for (const p of paragensRaw) {
    const calc = calcularParagem(paragemToInput(p), ctx);
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

  // Estrutura de custos (agregada sobre todas as paragens)
  let combustivel = 0,
    motorista = 0,
    veiculo = 0,
    adblue = 0,
    portagens = 0,
    extras = 0;
  for (const p of paragensRaw) {
    const c = calcularParagem(paragemToInput(p), ctx);
    combustivel += c.custoCombustivel;
    motorista += c.custoMotorista;
    veiculo += c.custoVeiculo;
    adblue += c.custoAdblue;
    portagens += c.portagensExtra + valorPortagem(p.zonaPortagem, ctx.tabelaPortagens).valor;
    extras += p.noitesFora + p.alimentacao + p.horasExtra * ctx.params.valorHoraExtra;
  }
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
