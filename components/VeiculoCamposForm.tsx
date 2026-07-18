"use client";

import type { Dispatch, SetStateAction } from "react";
import { CAMPOS_CUSTO, updPneu, type VeiculoForm } from "@/lib/veiculo-form";

/**
 * Campos de custo + tabela de pneus de um veículo. Partilhado entre o modal
 * de criação e a página de edição — só muda o "shell" à volta (modal vs.
 * página normal), o formulário em si é o mesmo.
 */
export default function VeiculoCamposForm({
  f,
  setF,
}: {
  f: VeiculoForm;
  setF: Dispatch<SetStateAction<VeiculoForm>>;
}) {
  function setNum(k: keyof VeiculoForm, v: string) {
    setF((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} />
        </div>
        <div>
          <label className="label">Matrícula</label>
          <input className="input" value={f.matricula} onChange={(e) => setF((p) => ({ ...p, matricula: e.target.value }))} />
        </div>
        {CAMPOS_CUSTO.map(([k, label]) => (
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

      <div className="mt-4">
        <h4 className="mb-2 font-semibold">Pneus por eixo (custo / km)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="th">Eixo</th>
                <th className="th">Custo (€)</th>
                <th className="th">KM de vida</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {f.pneus.map((p, i) => (
                <tr key={i}>
                  <td className="td">
                    <input className="input" value={p.eixo} onChange={(e) => updPneu(setF, i, "eixo", e.target.value)} />
                  </td>
                  <td className="td">
                    <input type="number" step="any" className="input" value={p.custo} onChange={(e) => updPneu(setF, i, "custo", Number(e.target.value))} />
                  </td>
                  <td className="td">
                    <input type="number" step="any" className="input" value={p.km} onChange={(e) => updPneu(setF, i, "km", Number(e.target.value))} />
                  </td>
                  <td className="td">
                    <button onClick={() => setF((pr) => ({ ...pr, pneus: pr.pneus.filter((_, j) => j !== i) }))} className="text-red-500 hover:text-red-700">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => setF((pr) => ({ ...pr, pneus: [...pr.pneus, { eixo: `${pr.pneus.length + 1} Eixo`, custo: 0, km: 100000 }] }))}
          className="btn-secondary mt-2 text-sm"
        >
          + Adicionar pneu
        </button>
      </div>
    </>
  );
}
