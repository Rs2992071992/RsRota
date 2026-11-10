"use client";

import { useState } from "react";
import { descarregarBlob } from "@/lib/descarregar";

// Na app Android de Administração (WebView) um link direto para um ficheiro não
// descarrega nada; passar por descarregarBlob abre a folha de partilha.
const FICHEIROS = {
  xlsx: "rotas_export.xlsx",
  csv: "rotas.csv",
} as const;

export default function ExportarBotoes() {
  const [aGerar, setAGerar] = useState<"xlsx" | "csv" | null>(null);
  const [erro, setErro] = useState("");

  async function exportar(formato: "xlsx" | "csv") {
    setErro("");
    setAGerar(formato);
    try {
      const res = await fetch(`/api/exportar?formato=${formato}`);
      if (!res.ok) return setErro("Erro ao gerar o ficheiro.");
      await descarregarBlob(await res.blob(), FICHEIROS[formato]);
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGerar(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={aGerar !== null} onClick={() => exportar("xlsx")}>
          {aGerar === "xlsx" ? "A gerar…" : "Exportar Excel"}
        </button>
        <button type="button" className="btn-secondary" disabled={aGerar !== null} onClick={() => exportar("csv")}>
          {aGerar === "csv" ? "A gerar…" : "Exportar CSV (rotas)"}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </>
  );
}
