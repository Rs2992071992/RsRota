"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportarCliente() {
  const router = useRouter();
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [estado, setEstado] = useState<"idle" | "a-importar">("idle");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function importar() {
    if (!ficheiro) return;
    // Ação destrutiva e irreversível (apaga TODAS as paragens antes de
    // inserir as do ficheiro) — uma confirmação a mais evita que um clique
    // enganado apague dados reais sem se dar por isso.
    if (!window.confirm("Isto apaga TODAS as paragens atuais e substitui-as pelas do ficheiro. Não há undo. Continuar?")) {
      return;
    }
    setEstado("a-importar");
    setErro(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("ficheiro", ficheiro);
      const res = await fetch("/api/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Erro ao importar.");
        return;
      }
      setResultado(
        `Importadas ${data.inseridas} paragens da folha "${data.folha}".` +
          (data.semData > 0 ? ` (${data.semData} sem data — atribuída a data de importação.)` : ""),
      );
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setEstado("idle");
    }
  }

  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">Importar Excel</h2>
      <p className="mb-3 text-sm text-gray-500">
        Carrega o ficheiro <code>viagens_app_final_profissional.xlsx</code>. Usa a folha
        <strong> Viagens_APP</strong>. ⚠️ Substitui todas as paragens existentes.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button onClick={importar} disabled={!ficheiro || estado === "a-importar"} className="btn">
          {estado === "a-importar" ? "A importar…" : "Importar"}
        </button>
      </div>
      {resultado && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{resultado}</p>}
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
