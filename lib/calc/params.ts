import type { CustosDerivados, ParametrosCusto, PneuItem } from "./types";

/**
 * Deriva os custos por km do motorista e do veículo a partir dos parâmetros.
 * Replica `custo_motorista_e_veiculo` do Excel.
 *
 * Custo veículo/km de referência ≈ 0,2746 €/km com os valores atuais.
 * Custo motorista/km de referência ≈ 0,2671 €/km com os valores atuais.
 */
export function derivarCustos(p: ParametrosCusto, pneus: PneuItem[]): CustosDerivados {
  // --- Motorista ---
  // custo mensal = salário + seguro + encargos(% do salário) + alimentação mensal
  const custoMensalMotorista =
    p.salarioMensal +
    p.seguroMensal +
    p.salarioMensal * p.percentEncargos +
    p.alimentacaoDia * p.diasAlimentacao;
  // custo/km = (custo mensal × fator anualização) / km anuais   [Excel: =(C9*14)/D2]
  const custoMotoristaPorKm =
    (custoMensalMotorista * p.fatorAnualizacao) / p.kmAnuais;

  // --- Veículo: custos fixos anuais ---
  const depreciacaoAnual = (p.valorAquisicao - p.valorResidual) / p.vidaUtilAnos;
  const jurosAnuais = p.taxaJuros * p.valorAquisicao;
  const custosFixosAnuais =
    p.iucAnual + jurosAnuais + depreciacaoAnual + p.seguroAnual;
  const custoFixoAnualKm = custosFixosAnuais / p.kmAnuais;

  // --- Veículo: manutenção por km ---
  const reparacoesKm = p.reparacoesAnuais / p.kmAnuais;
  const revisaoKm = p.revisaoAnual / p.kmAnuais;
  const inspecaoKm = p.inspecaoAnual / p.kmAnuais;
  // Pneus: cada eixo divide pelo seu próprio km de vida (não pelos km anuais).
  const pneusKm = pneus.reduce((acc, t) => acc + (t.km > 0 ? t.custo / t.km : 0), 0);
  const manutencaoKm = reparacoesKm + pneusKm + revisaoKm + inspecaoKm;

  const custoVeiculoPorKm = custoFixoAnualKm + manutencaoKm;

  return {
    custoMotoristaPorKm,
    custoVeiculoPorKm,
    detalhe: {
      custoMensalMotorista,
      depreciacaoAnual,
      jurosAnuais,
      custosFixosAnuais,
      custoFixoAnualKm,
      reparacoesKm,
      revisaoKm,
      inspecaoKm,
      pneusKm,
      manutencaoKm,
    },
  };
}
