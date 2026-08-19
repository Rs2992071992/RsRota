"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtData } from "@/lib/format";

export interface LinhaAvaria {
  id: number;
  veiculo: string;
  data: string; // ISO
  descricao: string;
  reportadoPor: string | null;
  resolvida: boolean;
}

export default function AvariasTabela({ linhas }: { linhas: LinhaAvaria[] }) {
  const router = useRouter();
  const [aAtualizar, setAAtualizar] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function alternarResolvida(id: number, resolvida: boolean) {
    setErro("");
    setAAtualizar(id);
    try {
      const res = await fetch(`/api/avarias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvida }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao atualizar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAtualizar(null);
    }
  }

  async function apagar(id: number) {
    if (!confirm("Apagar esta avaria?")) return;
    setErro("");
    try {
      const res = await fetch(`/api/avarias/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    }
  }

  function mailtoAvaria(l: LinhaAvaria): string {
    const assunto = `Avaria — ${l.veiculo}`;
    const corpo =
      `Veículo: ${l.veiculo}\n` +
      `Data: ${fmtData(l.data)}\n` +
      `Reportado por: ${l.reportadoPor || "—"}\n\n` +
      `Descrição:\n${l.descricao}`;
    return `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }

  return (
    <div className="overflow-x-auto">
      {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="th">Veículo</th>
            <th className="th">Data</th>
            <th className="th">Descrição</th>
            <th className="th">Reportado por</th>
            <th className="th">Estado</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.map((l) => (
            <tr key={l.id} className={l.resolvida ? "" : "bg-amber-50/40"}>
              <td className="td font-medium">{l.veiculo}</td>
              <td className="td whitespace-nowrap">{fmtData(l.data)}</td>
              <td className="td max-w-sm">{l.descricao}</td>
              <td className="td">{l.reportadoPor || "—"}</td>
              <td className="td">
                {l.resolvida ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    🟢 Resolvida
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    🟡 Pendente
                  </span>
                )}
              </td>
              <td className="td whitespace-nowrap text-right">
                <a href={mailtoAvaria(l)} className="mr-3 text-sm font-medium text-brand hover:underline">
                  Enviar email
                </a>
                <button
                  onClick={() => alternarResolvida(l.id, !l.resolvida)}
                  disabled={aAtualizar === l.id}
                  className="mr-3 text-sm font-medium text-brand hover:underline"
                >
                  {l.resolvida ? "Reabrir" : "Marcar resolvida"}
                </button>
                <button onClick={() => apagar(l.id)} className="text-red-500 hover:text-red-700">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
