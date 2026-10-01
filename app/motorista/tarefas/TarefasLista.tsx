"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtData } from "@/lib/format";

export interface TarefaMotorista {
  id: number;
  dataPrevista: string; // ISO
  titulo: string;
  descricao: string | null;
  concluida: boolean;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export default function TarefasLista({ inicial }: { inicial: TarefaMotorista[] }) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState(inicial);
  const [aAtualizar, setAAtualizar] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function alternar(t: TarefaMotorista) {
    setErro("");
    setAAtualizar(t.id);
    try {
      const res = await fetch(`/api/tarefas/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluida: !t.concluida }),
      });
      const resp = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(resp.erro || "Erro ao atualizar.");
      setTarefas((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluida: resp.tarefa.concluida } : x)));
      // O número no separador vem do layout (servidor) — força-o a recalcular.
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAtualizar(null);
    }
  }

  const pendentes = tarefas.filter((t) => !t.concluida);
  const feitas = tarefas.filter((t) => t.concluida);
  const hojeIso = hoje();

  const linha = (t: TarefaMotorista) => {
    const atrasada = !t.concluida && t.dataPrevista.slice(0, 10) < hojeIso;
    const ehHoje = !t.concluida && t.dataPrevista.slice(0, 10) === hojeIso;
    return (
      <li key={t.id} className="flex items-start gap-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={t.concluida}
          disabled={aAtualizar === t.id}
          onChange={() => alternar(t)}
        />
        <div className={`flex-1 ${t.concluida ? "text-gray-400 line-through" : ""}`}>
          <p className="text-sm font-medium">{t.titulo}</p>
          <p
            className={`text-xs ${
              atrasada ? "font-semibold text-red-600" : ehHoje ? "font-semibold text-brand" : "text-gray-500"
            }`}
          >
            {fmtData(t.dataPrevista)}
            {atrasada && " · em atraso"}
            {ehHoje && " · hoje"}
          </p>
          {t.descricao && <p className="mt-1 text-xs text-gray-500">{t.descricao}</p>}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="mb-1 text-lg font-bold">Tarefas</h1>
        <p className="mb-2 text-xs text-gray-500">Pedidos do escritório. Marque quando estiverem feitas.</p>
        {pendentes.length === 0 ? (
          <p className="text-sm text-gray-500">Não tem tarefas pendentes. ✅</p>
        ) : (
          <ul className="divide-y divide-gray-100">{pendentes.map(linha)}</ul>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>
      {feitas.length > 0 && (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold text-gray-500">Feitas</h2>
          <ul className="divide-y divide-gray-100">{feitas.map(linha)}</ul>
        </div>
      )}
    </div>
  );
}
