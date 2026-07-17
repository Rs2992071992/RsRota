import { calcularParagem, coeficienteReal, efetivos, pesoTransportado, type ContextoCalculo } from "./perStop";
import { valorPortagem } from "./lookups";
import type { ParagemInput, RateioCliente, RotaCalc } from "./types";

/**
 * Calcula uma rota completa a partir das suas paragens (§4.2).
 * Agrega custos, calcula rentabilidade e o rateio auditável por cliente.
 */
export function calcularRota(
  idRota: string,
  paragens: ParagemInput[],
  ctx: ContextoCalculo,
): RotaCalc {
  // Custos efetivos por paragem (snapshot congelado ou contexto atual).
  const effs = paragens.map((p) => efetivos(p, ctx));
  const calc = paragens.map((p) => calcularParagem(p, ctx));

  // Componentes do custo total da rota.
  const somaCustoParagens = calc.reduce((a, c) => a + c.custoParagem, 0);
  // Noites: nº de noites × valor por noite (congelado por paragem).
  const somaNoites = paragens.reduce(
    (a, p, i) => a + (p.noitesFora || 0) * effs[i].valorNoite,
    0,
  );
  const somaAlimentacao = paragens.reduce((a, p) => a + (p.alimentacao || 0), 0);
  const somaHorasExtraValor = paragens.reduce(
    (a, p, i) => a + (p.horasExtra || 0) * effs[i].valorHoraExtra,
    0,
  );
  const somaPortagensTabela = paragens.reduce(
    (a, p) => a + valorPortagem(p.zonaPortagem, ctx.tabelaPortagens).valor,
    0,
  );

  const custoTotalRota =
    somaCustoParagens +
    somaNoites +
    somaAlimentacao +
    somaHorasExtraValor +
    somaPortagensTabela;

  // Rentabilidade. Margem mínima congelada (primeira paragem; fallback contexto).
  const margemMinima = effs[0]?.margemMinima ?? ctx.params.margemMinima;
  const precoMinimo = custoTotalRota * margemMinima;
  const receitaTotal = paragens.reduce((a, p) => a + (p.receitaPaga || 0), 0);
  const lucro = receitaTotal - custoTotalRota;
  const alerta: RotaCalc["alerta"] = lucro < 0 ? "🔴 PREJUÍZO" : "🟢 OK";

  // Rateio por cliente (auditável). O custo total da rota é repartido de forma
  // proporcional ao coeficiente de carga (peso/capacidade) de cada cliente,
  // NORMALIZADO para somar 100 %. Assim Σ custoAtribuido = custoTotalRota e
  // Σ margem = lucro. Trajetos a vazio (VAZIO ou camião sem carga) não recebem
  // linha própria: o seu custo já está no total e dilui-se nos clientes reais.
  const porCliente = new Map<string, RateioCliente>();
  let somaCoef = 0;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    // Só os trajetos a vazio (VAZIO) ficam de fora: são repositionamento, sem
    // cliente a faturar. Qualquer outro tipo participa (mesmo com peso 0 mal
    // registado), para nunca perder um cliente realmente faturado.
    if (p.tipoVeiculo === "VAZIO") continue;
    const coef = coeficienteReal(p.tipoVeiculo, pesoTransportado(p), effs[i], p.nPaletes || 0);
    const chave = p.cliente || "(sem cliente)";
    const atual = porCliente.get(chave) ?? {
      cliente: chave,
      coefReal: 0,
      quota: 0,
      custoAtribuido: 0,
      receitaPaga: 0,
    };
    atual.coefReal += coef;
    atual.receitaPaga += p.receitaPaga || 0;
    porCliente.set(chave, atual);
    somaCoef += coef;
  }
  // Normalização: quota = coefReal / Σcoef. Garde-fou contra divisão por zero
  // (nenhum arrêt participante) — reparte igualmente entre os clientes presentes.
  const clientes = Array.from(porCliente.values());
  const denom = somaCoef > 0 ? somaCoef : clientes.length || 1;
  for (const c of clientes) {
    c.quota = somaCoef > 0 ? c.coefReal / denom : 1 / denom;
    c.custoAtribuido = c.quota * custoTotalRota;
  }

  const kmTotais = calc.reduce((a, c) => a + c.kmFeitos, 0);
  const totalKgCarregados = paragens.reduce((a, p) => a + (p.kgCarregados || 0), 0);
  const totalKgDescarregados = paragens.reduce((a, p) => a + (p.kgDescarregados || 0), 0);
  const totalPaletes = paragens.reduce(
    (a, p) =>
      a + (p.tipoVeiculo === "PALETE_120X80" || p.tipoVeiculo === "PALETE_120X100" ? p.nPaletes || 0 : 0),
    0,
  );

  // Datas da rota: a mais antiga (início) e a mais recente (fim) das paragens.
  const tempos = paragens
    .map((p) => (p.data ? new Date(p.data).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const dataInicio = tempos.length ? new Date(Math.min(...tempos)) : new Date();
  const dataFim = tempos.length ? new Date(Math.max(...tempos)) : dataInicio;

  return {
    idRota,
    dataInicio,
    dataFim,
    paragens: calc,
    somaCustoParagens,
    somaNoites,
    somaAlimentacao,
    somaHorasExtraValor,
    somaPortagensTabela,
    custoTotalRota,
    precoMinimo,
    receitaTotal,
    lucro,
    alerta,
    rateio: clientes,
    kmTotais,
    totalKgCarregados,
    totalKgDescarregados,
    totalPaletes,
  };
}

/** Agrupa paragens por ID Rota e calcula cada rota. */
export function calcularRotas(paragens: ParagemInput[], ctx: ContextoCalculo): RotaCalc[] {
  const grupos = new Map<string, ParagemInput[]>();
  for (const p of paragens) {
    const arr = grupos.get(p.idRota) ?? [];
    arr.push(p);
    grupos.set(p.idRota, arr);
  }
  return Array.from(grupos.entries()).map(([idRota, ps]) => calcularRota(idRota, ps, ctx));
}
