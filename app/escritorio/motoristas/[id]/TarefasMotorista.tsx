"use client";

import { useState } from "react";
import { fmtData } from "@/lib/format";

export interface TarefaItem {
  id: number;
  dataPrevista: string; // ISO
  titulo: string;
  descricao: string | null;
  concluida: boolean;
  concluidaEm: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export default function TarefasMotorista({
  motoristaId,
  inicial,
}: {
  motoristaId: number;
  inicial: TarefaItem[];
}) {
  const [tarefas, setTarefas] = useState(inicial);
  const [data, setData] = useState(hoje());
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  const ordenar = (lista: TarefaItem[]) =>
    [...lista].sort(
      (a, b) =>
        Number(a.concluida) - Number(b.concluida) ||
        a.dataPrevista.localeCompare(b.dataPrevista) ||
        a.id - b.id,
    );

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!titulo.trim()) return setErro("Escreva o que o motorista tem de fazer.");
    setAGravar(true);
    try {
      const res = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motoristaId,
          dataPrevista: data,
          titulo,
          descricao: descricao.trim() || null,
        }),
      });
      const resp = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(resp.erro || "Erro ao criar a tarefa.");
      setTarefas((prev) => ordenar([...prev, resp.tarefa]));
      setTitulo("");
      setDescricao("");
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  async function alternar(t: TarefaItem) {
    setErro("");
    const res = await fetch(`/api/tarefas/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluida: !t.concluida }),
    }).catch(() => null);
    const resp = await res?.json().catch(() => ({}));
    if (!res || !res.ok) return setErro(resp?.erro || "Erro ao atualizar a tarefa.");
    setTarefas((prev) => ordenar(prev.map((x) => (x.id === t.id ? resp.tarefa : x))));
  }

  async function apagar(t: TarefaItem) {
    if (!confirm(`Apagar a tarefa "${t.titulo}"?`)) return;
    setErro("");
    const res = await fetch(`/api/tarefas/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) return setErro("Erro ao apagar a tarefa.");
    setTarefas((prev) => prev.filter((x) => x.id !== t.id));
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Tarefas</h2>
      <p className="text-xs text-gray-500">
        Pedidos para este motorista (ex.: recolha num sítio, aferir o tacógrafo). Aparecem na app dele,
        na secção Tarefas.
      </p>

      <form onSubmit={adicionar} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="label">Tarefa</label>
            <input
              className="input"
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Recolha em Porto — Cliente X"
            />
          </div>
        </div>
        <div>
          <label className="label">Detalhes (opcional)</label>
          <textarea
            className="input"
            rows={2}
            maxLength={1000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <button className="btn" disabled={aGravar}>
          {aGravar ? "A guardar…" : "Adicionar tarefa"}
        </button>
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {tarefas.length === 0 ? (
        <p className="text-sm text-gray-500">Sem tarefas.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {tarefas.map((t) => (
            <li key={t.id} className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={t.concluida}
                onChange={() => alternar(t)}
                title="Marcar como feita"
              />
              <div className={`flex-1 ${t.concluida ? "text-gray-400" : ""}`}>
                <span className="font-medium">{fmtData(t.dataPrevista)}</span> — {t.titulo}
                {t.descricao && <p className="text-xs text-gray-500">{t.descricao}</p>}
                {t.concluida && t.concluidaEm && (
                  <p className="text-xs">Feita em {fmtData(t.concluidaEm)}</p>
                )}
              </div>
              <button onClick={() => apagar(t)} className="text-xs text-red-600 hover:underline">
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
