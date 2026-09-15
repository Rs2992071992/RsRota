"use client";

import { useState } from "react";
import { fmtEuro, fmtNum } from "@/lib/format";

export interface ManutencaoBD {
  id: number;
  descricao: string;
  data: string;
  valor: number | null;
  dias: number | null;
}

export default function ManutencoesModal({
  veiculoId,
  veiculoNome,
  manutencoesIniciais,
  onClose,
  onChanged,
}: {
  veiculoId: number;
  veiculoNome: string;
  manutencoesIniciais: ManutencaoBD[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [linhas, setLinhas] = useState<ManutencaoBD[]>(manutencoesIniciais);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [erro, setErro] = useState("");

  const totalDias = linhas.reduce((s, m) => s + (m.dias ?? 0), 0);
  const totalCusto = linhas.reduce((s, m) => s + (m.valor ?? 0), 0);

  function updLocal(id: number, campo: keyof ManutencaoBD, valor: string | number | null) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  async function guardarCampo(id: number, campo: "descricao" | "data" | "valor" | "dias", valor: string | number | null) {
    setErro("");
    try {
      const res = await fetch(`/api/manutencoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao guardar.");
        return;
      }
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    }
  }

  async function adicionar() {
    setErro("");
    setAAdicionar(true);
    try {
      const res = await fetch(`/api/veiculos/${veiculoId}/manutencoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: "", data: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao adicionar.");
        return;
      }
      const { manutencao } = await res.json();
      setLinhas((ls) => [
        { id: manutencao.id, descricao: manutencao.descricao, data: manutencao.data, valor: manutencao.valor, dias: manutencao.dias },
        ...ls,
      ]);
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAdicionar(false);
    }
  }

  async function apagar(id: number) {
    if (!confirm("Apagar esta manutenção?")) return;
    setErro("");
    try {
      const res = await fetch(`/api/manutencoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        return;
      }
      setLinhas((ls) => ls.filter((l) => l.id !== id));
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Manutenções — {veiculoNome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Total dias parado</p>
            <p className="font-bold">{fmtNum(totalDias)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Custo total reparações</p>
            <p className="font-bold">{fmtEuro(totalCusto)}</p>
          </div>
        </div>

        <div className="scroll-fade-x overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <thead>
              <tr>
                <th className="th">Descrição</th>
                <th className="th w-32">Data</th>
                <th className="th w-24">Valor (€)</th>
                <th className="th w-20">Dias parado</th>
                <th className="th w-8" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="td">
                    <input
                      className="input"
                      value={l.descricao}
                      onChange={(e) => updLocal(l.id, "descricao", e.target.value)}
                      onBlur={(e) => guardarCampo(l.id, "descricao", e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="date"
                      className="input"
                      value={l.data.slice(0, 10)}
                      onChange={(e) => updLocal(l.id, "data", e.target.value)}
                      onBlur={(e) => guardarCampo(l.id, "data", e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={l.valor ?? ""}
                      placeholder="—"
                      onChange={(e) => updLocal(l.id, "valor", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => guardarCampo(l.id, "valor", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={l.dias ?? ""}
                      placeholder="—"
                      onChange={(e) => updLocal(l.id, "dias", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => guardarCampo(l.id, "dias", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </td>
                  <td className="td">
                    <button onClick={() => apagar(l.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={adicionar} disabled={aAdicionar} className="btn-secondary mt-2 text-sm">
          {aAdicionar ? "A adicionar…" : "+ Nova manutenção"}
        </button>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn">Fechar</button>
        </div>
      </div>
    </div>
  );
}
