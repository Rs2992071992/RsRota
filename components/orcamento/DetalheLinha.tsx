"use client";

import { useState } from "react";
import { fmtEuro, fmtNum2 } from "@/lib/format";
import type { DetalheEstimativa } from "@/lib/calc/orcamento";

interface Props {
  detalhe: DetalheEstimativa;
  custoEstimado: number;
  preco: number;
}

/**
 * Painel de detalhe do cálculo de uma linha — uso INTERNO (escritório). Mostra a
 * decomposição do custo e a margem aplicada (preço ÷ custo) para detetar erros.
 * Nunca aparece no PDF do cliente.
 */
export default function DetalheLinha({ detalhe, custoEstimado, preco }: Props) {
  const [aberto, setAberto] = useState(false);

  const margem = custoEstimado > 0 ? preco / custoEstimado : 0;
  const abaixoMinimo = margem > 0 && margem < detalhe.margemMinima;
  const prejuizo = preco > 0 && preco < custoEstimado;
  const corMargem = prejuizo
    ? "text-red-600"
    : abaixoMinimo
      ? "text-amber-600"
      : "text-green-600";

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/60">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-600"
      >
        <span>🔍 Detalhe do cálculo (interno — não vai no PDF)</span>
        <span className="flex items-center gap-3">
          <span className={corMargem}>
            Margem {margem > 0 ? `${fmtNum2(margem)}×` : "—"}
            {prejuizo ? " · PREJUÍZO" : abaixoMinimo ? " · abaixo do mínimo" : ""}
          </span>
          <span>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>

      {aberto && (
        <div className="space-y-1 border-t border-gray-200 px-3 py-2 text-xs text-gray-700">
          <Linha rotulo={`Km (${detalhe.km}) · peso ${detalhe.pesoKg} kg`} valor="" />
          <Linha
            rotulo={
              detalhe.nPaletes > 0 ? `Ocupação (${detalhe.nPaletes} paletes)` : "Ocupação"
            }
            valor={`${(detalhe.coeficienteCarga * 100).toFixed(1)}%`}
          />
          <Linha
            rotulo={`Combustível (${fmtNum2(detalhe.consumoL100)} L/100 → ${fmtNum2(
              detalhe.litrosGastos,
            )} L × ${fmtEuro(detalhe.precoCombUsado)})`}
            valor={fmtEuro(detalhe.custoCombustivel)}
          />
          <Linha
            rotulo={`AdBlue (${fmtNum2(detalhe.adblueLitros)} L)`}
            valor={fmtEuro(detalhe.custoAdblue)}
          />
          <Linha
            rotulo={`Motorista (${fmtNum2(detalhe.custoMotoristaPorKm)} €/km × ${detalhe.km})`}
            valor={fmtEuro(detalhe.custoMotorista)}
          />
          <Linha
            rotulo={`Veículo (${fmtNum2(detalhe.custoVeiculoPorKm)} €/km × ${detalhe.km})`}
            valor={fmtEuro(detalhe.custoVeiculo)}
          />
          <Linha
            rotulo={`Portagens (${detalhe.portagemAuto ? "auto camião" : "tabela zona"})`}
            valor={fmtEuro(detalhe.portagem)}
          />
          {detalhe.portagensExtra > 0 && (
            <Linha rotulo="Portagens extra" valor={fmtEuro(detalhe.portagensExtra)} />
          )}
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold">
            <span>Custo total</span>
            <span>{fmtEuro(custoEstimado)}</span>
          </div>
          <div className="flex justify-between">
            <span>Preço mínimo (× {fmtNum2(detalhe.margemMinima)})</span>
            <span>{fmtEuro(custoEstimado * detalhe.margemMinima)}</span>
          </div>
          <div className={`flex justify-between font-semibold ${corMargem}`}>
            <span>Preço atual · margem</span>
            <span>
              {fmtEuro(preco)} · {margem > 0 ? `${fmtNum2(margem)}×` : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{rotulo}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
