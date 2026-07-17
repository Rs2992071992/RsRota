"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { derivarCustos } from "@/lib/calc/params";
import type { ParametrosCusto } from "@/lib/calc/types";
import { fmtEuro, fmtNum2 } from "@/lib/format";

export interface MotoristaParamsBD {
  nome: string | null;
  salarioMensal: number;
  seguroMensal: number;
  percentEncargos: number;
  alimentacaoDia: number;
  diasAlimentacao: number;
  kmAnuais: number;
  fatorAnualizacao: number;
}

const CAMPOS: [keyof MotoristaParamsBD, string][] = [
  ["salarioMensal", "Salário mensal (€)"],
  ["seguroMensal", "Seguro mensal (€)"],
  ["percentEncargos", "Encargos empresa (fração, ex. 0,235)"],
  ["alimentacaoDia", "Alimentação por dia (€)"],
  ["diasAlimentacao", "Dias de alimentação"],
  ["kmAnuais", "KM anuais de referência"],
  ["fatorAnualizacao", "Fator anualização (14 salários PT)"],
];

/** custo motorista/km (independente do veículo). */
function custoMotoristaKm(f: MotoristaParamsBD): { porKm: number; mensal: number } {
  const fake: ParametrosCusto = {
    salarioMensal: f.salarioMensal, seguroMensal: f.seguroMensal,
    percentEncargos: f.percentEncargos, alimentacaoDia: f.alimentacaoDia,
    diasAlimentacao: f.diasAlimentacao, kmAnuais: f.kmAnuais, fatorAnualizacao: f.fatorAnualizacao,
    valorAquisicao: 0, valorResidual: 0, vidaUtilAnos: 1, iucAnual: 0, taxaJuros: 0,
    seguroAnual: 0, reparacoesAnuais: 0, revisaoAnual: 0, inspecaoAnual: 0,
    precoCombRef: 0, precoCombReal: 0, consumoAdblue: 0, precoAdblue: 0,
    margemMinima: 0, valorHoraExtra: 0, valorNoite: 0, capacidadeCamiao: 1, capacidadeReboque: 1,
    capacidadePaleteA: 1, capacidadePaleteB: 1,
  };
  const d = derivarCustos(fake, []);
  return { porKm: d.custoMotoristaPorKm, mensal: d.detalhe.custoMensalMotorista };
}

export default function MotoristaParamsForm({
  id,
  inicial,
}: {
  id: number;
  inicial: MotoristaParamsBD;
}) {
  const router = useRouter();
  const [f, setF] = useState<MotoristaParamsBD>(inicial);
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "ok" | "erro">("idle");

  const derivado = useMemo(() => custoMotoristaKm(f), [f]);

  function setNum(k: keyof MotoristaParamsBD, v: string) {
    setF((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  }

  async function guardar() {
    setEstado("a-gravar");
    try {
      const res = await fetch(`/api/motoristas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        setEstado("erro");
        return;
      }
      setEstado("ok");
      router.refresh();
      setTimeout(() => setEstado("idle"), 2000);
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Parâmetros salariais</h2>
        <button onClick={guardar} disabled={estado === "a-gravar"} className="btn">
          {estado === "a-gravar" ? "A guardar…" : estado === "ok" ? "✓ Guardado" : "Guardar"}
        </button>
      </div>

      {estado === "erro" && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Erro ao guardar.</p>
      )}

      <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
        Custo motorista / km: <span className="font-bold">{fmtNum2(derivado.porKm)} €</span>
        <span className="mx-2 text-gray-300">·</span>
        Custo mensal: <span className="font-bold">{fmtEuro(derivado.mensal)}</span>
      </div>

      <p className="text-xs text-gray-500">
        Alterar estes valores só afeta rotas <strong>futuras</strong>. As rotas já registadas
        mantêm os custos congelados no momento do registo.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAMPOS.map(([k, label]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <input
              type="number"
              step="any"
              className="input"
              value={f[k] as number}
              onChange={(e) => setNum(k, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
