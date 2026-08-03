"use client";

import { useState } from "react";

export interface TipoPaleteBD {
  id: number;
  nome: string;
  comprimentoMm: number;
  larguraMm: number;
  ativo: boolean;
}

/**
 * Catálogo de tipos de palete (mm), usado no empacotamento em Cargas. Tabela
 * própria (CRUD via /api/tipos-palete), não faz parte do "Guardar tudo" dos
 * outros grupos de Parâmetros — cada linha grava-se sozinha (mesmo padrão do
 * ManutencoesModal: guarda por campo no onBlur, "+ Novo" cria já no servidor).
 */
export default function TiposPaleteEditor({ tiposIniciais }: { tiposIniciais: TipoPaleteBD[] }) {
  const [linhas, setLinhas] = useState<TipoPaleteBD[]>(tiposIniciais);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [erro, setErro] = useState("");

  function updLocal(id: number, campo: keyof TipoPaleteBD, valor: string | number | boolean) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  async function guardarCampo(id: number, campo: "nome" | "comprimentoMm" | "larguraMm" | "ativo", valor: string | number | boolean) {
    setErro("");
    try {
      const res = await fetch(`/api/tipos-palete/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao guardar.");
      }
    } catch {
      setErro("Erro de ligação.");
    }
  }

  async function adicionar() {
    setErro("");
    setAAdicionar(true);
    try {
      const res = await fetch("/api/tipos-palete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Novo tipo", comprimentoMm: 1200, larguraMm: 800 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao adicionar.");
        return;
      }
      const { tipoPalete } = await res.json();
      setLinhas((ls) => [...ls, tipoPalete]);
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAdicionar(false);
    }
  }

  async function apagar(id: number) {
    if (!confirm("Apagar este tipo de palete?")) return;
    setErro("");
    try {
      const res = await fetch(`/api/tipos-palete/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        return;
      }
      setLinhas((ls) => ls.filter((l) => l.id !== id));
    } catch {
      setErro("Erro de ligação.");
    }
  }

  return (
    <div className="card">
      <h3 className="mb-1 font-semibold">Tipos de palete (mm)</h3>
      <p className="mb-3 text-xs text-gray-500">
        Catálogo de formatos físicos usado no empacotamento em <strong>Cargas</strong> — distinto da
        capacidade agregada (nº por camião) do grupo &quot;Paletes&quot; acima.
      </p>
      {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="th">Nome</th>
              <th className="th">Comprimento (mm)</th>
              <th className="th">Largura (mm)</th>
              <th className="th">Ativo</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="td">
                  <input
                    className="input"
                    value={l.nome}
                    onChange={(e) => updLocal(l.id, "nome", e.target.value)}
                    onBlur={(e) => guardarCampo(l.id, "nome", e.target.value)}
                  />
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.comprimentoMm}
                    onChange={(e) => updLocal(l.id, "comprimentoMm", Number(e.target.value))}
                    onBlur={(e) => guardarCampo(l.id, "comprimentoMm", Number(e.target.value))}
                  />
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.larguraMm}
                    onChange={(e) => updLocal(l.id, "larguraMm", Number(e.target.value))}
                    onBlur={(e) => guardarCampo(l.id, "larguraMm", Number(e.target.value))}
                  />
                </td>
                <td className="td">
                  <input
                    type="checkbox"
                    checked={l.ativo}
                    onChange={(e) => {
                      updLocal(l.id, "ativo", e.target.checked);
                      guardarCampo(l.id, "ativo", e.target.checked);
                    }}
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
        {aAdicionar ? "A adicionar…" : "+ Novo tipo de palete"}
      </button>
    </div>
  );
}
