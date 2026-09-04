"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  CAMPOS_CAPACIDADE,
  CAMPOS_CUSTO_COMUM,
  CAMPOS_DEPRECIACAO,
  updConsumo,
  updPneu,
  type VeiculoForm,
} from "@/lib/veiculo-form";

/**
 * Campos de custo + tabela de pneus de um veículo. Partilhado entre o modal
 * de criação e a página de edição — só muda o "shell" à volta (modal vs.
 * página normal), o formulário em si é o mesmo.
 */
export default function VeiculoCamposForm({
  f,
  setF,
  reboques,
}: {
  f: VeiculoForm;
  setF: Dispatch<SetStateAction<VeiculoForm>>;
  /** Catálogo de reboques (ver /escritorio/cargas) — para "Reboque habitual". */
  reboques: { id: number; nome: string }[];
}) {
  function setNum(k: keyof VeiculoForm, v: string) {
    setF((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  }

  function setNumNullable(k: "caixaComprimentoMm" | "caixaLarguraMm", v: string) {
    setF((p) => ({ ...p, [k]: v === "" ? null : Number(v) }));
  }

  const pesado = f.categoria === "PESADO";

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
        <div>
          <label className="label">Categoria</label>
          <select
            className="input"
            value={f.categoria}
            onChange={(e) => setF((p) => ({ ...p, categoria: e.target.value as "LIGEIRO" | "PESADO" }))}
          >
            <option value="PESADO">Pesado (camião)</option>
            <option value="LIGEIRO">Ligeiro (carrinha/carro)</option>
          </select>
        </div>
        {CAMPOS_CUSTO_COMUM.map(([k, label]) => (
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
        {pesado && (
          <>
            {CAMPOS_DEPRECIACAO.map(([k, label]) => (
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
            {CAMPOS_CAPACIDADE.map(([k, label]) => (
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
            <div>
              <label className="label">Caixa — comprimento (mm)</label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="—"
                value={f.caixaComprimentoMm ?? ""}
                onChange={(e) => setNumNullable("caixaComprimentoMm", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Caixa — largura (mm)</label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="—"
                value={f.caixaLarguraMm ?? ""}
                onChange={(e) => setNumNullable("caixaLarguraMm", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Reboque habitual</label>
              <select
                className="input"
                value={f.reboqueHabitualId ?? ""}
                onChange={(e) =>
                  setF((p) => ({ ...p, reboqueHabitualId: e.target.value === "" ? null : Number(e.target.value) }))
                }
              >
                <option value="">— nenhum (só camião) —</option>
                {reboques.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fator de ocupação de paletes</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                placeholder="1"
                value={f.fatorOcupacaoPalete}
                onChange={(e) => setNum("fatorOcupacaoPalete", e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Reduz a capacidade calculada por dimensão (1 = confiar na geometria) — ajustar só se
                este veículo/reboque levar sistematicamente menos paletes do que a geometria sugere.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-amber-50/60 p-3">
        <div>
          <label className="label">Data limite de inspeção</label>
          <input
            type="date"
            className="input"
            value={f.dataLimiteInspecao ?? ""}
            onChange={(e) =>
              setF((p) => ({ ...p, dataLimiteInspecao: e.target.value || null, inspecaoVerificada: false }))
            }
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.inspecaoVerificada}
              disabled={!f.dataLimiteInspecao}
              onChange={(e) => setF((p) => ({ ...p, inspecaoVerificada: e.target.checked }))}
            />
            Já foi à inspeção (silencia o aviso ao motorista)
          </label>
        </div>
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

      {pesado && (
        <div className="mt-4">
          <h4 className="mb-2 font-semibold">Consumo por carga (L/100km)</h4>
          <p className="mb-2 text-xs text-gray-500">
            Escalões próprios deste veículo. Sem linhas aqui, o cálculo usa a tabela global de
            Parâmetros.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Carga (kg)</th>
                  <th className="th">Consumo (L/100km)</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {f.consumo.map((c, i) => (
                  <tr key={i}>
                    <td className="td">
                      <input
                        type="number"
                        step="any"
                        className="input"
                        value={c.cargaKg}
                        onChange={(e) => updConsumo(setF, i, "cargaKg", Number(e.target.value))}
                      />
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        step="any"
                        className="input"
                        value={c.consumoL100}
                        onChange={(e) => updConsumo(setF, i, "consumoL100", Number(e.target.value))}
                      />
                    </td>
                    <td className="td">
                      <button
                        onClick={() => setF((pr) => ({ ...pr, consumo: pr.consumo.filter((_, j) => j !== i) }))}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => setF((pr) => ({ ...pr, consumo: [...pr.consumo, { cargaKg: 0, consumoL100: 0 }] }))}
            className="btn-secondary mt-2 text-sm"
          >
            + Adicionar linha
          </button>
        </div>
      )}
    </>
  );
}
