import { calcularParagem, coeficienteReal, pesoTransportado, type ContextoCalculo } from "./perStop";
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
  const calc = paragens.map((p) => calcularParagem(p, ctx));

  // Componentes do custo total da rota.
  const somaCustoParagens = calc.reduce((a, c) => a + c.custoParagem, 0);
  // Noites: nº de noites × valor por noite (parâmetro do escritório).
  const somaNoites = paragens.reduce(
    (a, p) => a + (p.noitesFora || 0) * ctx.params.valorNoite,
    0,
  );
  const somaAlimentacao = paragens.reduce((a, p) => a + (p.alimentacao || 0), 0);
  const somaHorasExtraValor = paragens.reduce(
    (a, p) => a + (p.horasExtra || 0) * ctx.params.valorHoraExtra,
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

  // Rentabilidade.
  const precoMinimo = custoTotalRota * ctx.params.margemMinima;
  const receitaTotal = paragens.reduce((a, p) => a + (p.receitaPaga || 0), 0);
  const lucro = receitaTotal - custoTotalRota;
  const alerta: RotaCalc["alerta"] = lucro < 0 ? "🔴 PREJUÍZO" : "🟢 OK";

  // Rateio por cliente (auditável). custo atribuído de cada paragem =
  // coefReal × custo total da rota; agregamos por cliente.
  const porCliente = new Map<string, RateioCliente>();
  for (const p of paragens) {
    const coef = coeficienteReal(p.tipoVeiculo, pesoTransportado(p), ctx.params);
    const atribuido = coef * custoTotalRota;
    const chave = p.cliente || "(sem cliente)";
    const atual = porCliente.get(chave) ?? {
      cliente: chave,
      coefReal: 0,
      custoAtribuido: 0,
      receitaPaga: 0,
    };
    atual.coefReal += coef;
    atual.custoAtribuido += atribuido;
    atual.receitaPaga += p.receitaPaga || 0;
    porCliente.set(chave, atual);
  }

  const kmTotais = calc.reduce((a, c) => a + c.kmFeitos, 0);

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
    rateio: Array.from(porCliente.values()),
    kmTotais,
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
