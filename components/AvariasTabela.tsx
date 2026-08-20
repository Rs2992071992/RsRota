"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtData } from "@/lib/format";

export interface ItemAvaria {
  id: number;
  texto: string;
  resolvido: boolean;
}

export interface LinhaAvaria {
  id: number;
  veiculo: string;
  data: string; // ISO
  itens: ItemAvaria[];
  observacoes: string | null;
  reportadoPor: string | null;
  resolvida: boolean;
}

export default function AvariasTabela({ linhas: linhasIniciais }: { linhas: LinhaAvaria[] }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [aAtualizar, setAAtualizar] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function alternarItem(avariaId: number, item: ItemAvaria) {
    setErro("");
    const chave = `${avariaId}:${item.id}`;
    setAAtualizar(chave);
    try {
      const res = await fetch(`/api/avarias/${avariaId}/itens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvido: !item.resolvido }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao atualizar.");
        return;
      }
      const { avaria } = await res.json();
      setLinhas((prev) =>
        prev.map((l) => (l.id !== avariaId ? l : { ...l, itens: avaria.itens, resolvida: avaria.resolvida })),
      );
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAtualizar(null);
    }
  }

  async function apagar(id: number) {
    if (!confirm("Apagar este pedido de manutenção?")) return;
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
    const assunto = `Pedido de Manutenção — ${l.veiculo}`;
    const corpo =
      `Veículo: ${l.veiculo}\n` +
      `Data: ${fmtData(l.data)}\n` +
      `Reportado por: ${l.reportadoPor || "—"}\n\n` +
      `Situações:\n${l.itens.map((i) => `- [${i.resolvido ? "x" : " "}] ${i.texto}`).join("\n")}` +
      (l.observacoes ? `\n\nObservações:\n${l.observacoes}` : "");
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
            <th className="th">Situações</th>
            <th className="th">Reportado por</th>
            <th className="th">Estado</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.map((l) => (
            <tr key={l.id} className={l.resolvida ? "" : "bg-amber-50/40"}>
              <td className="td font-medium align-top">{l.veiculo}</td>
              <td className="td whitespace-nowrap align-top">{fmtData(l.data)}</td>
              <td className="td max-w-sm align-top">
                <ul className="space-y-1">
                  {l.itens.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={item.resolvido}
                          disabled={aAtualizar === `${l.id}:${item.id}`}
                          onChange={() => alternarItem(l.id, item)}
                        />
                        <span className={item.resolvido ? "text-gray-400 line-through" : ""}>{item.texto}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {l.observacoes && <p className="mt-1 text-xs italic text-gray-500">Obs.: {l.observacoes}</p>}
              </td>
              <td className="td align-top">{l.reportadoPor || "—"}</td>
              <td className="td align-top">
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
              <td className="td whitespace-nowrap text-right align-top">
                <a href={mailtoAvaria(l)} className="mr-3 text-sm font-medium text-brand hover:underline">
                  Enviar email
                </a>
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
