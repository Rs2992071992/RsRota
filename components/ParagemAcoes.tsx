"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ParagemEditor, { type ParagemEditavel, type VeiculoOpcao } from "@/components/ParagemEditor";

interface Props {
  paragem: ParagemEditavel;
  zonas: string[];
  veiculos: VeiculoOpcao[];
  valorNoite: number;
  pesoMedioPaleteA: number;
  pesoMedioPaleteB: number;
}

/** Botões "Editar" e "Apagar" (escritório) para uma paragem. */
export default function ParagemAcoes({
  paragem,
  zonas,
  veiculos,
  valorNoite,
  pesoMedioPaleteA,
  pesoMedioPaleteB,
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [aApagar, setAApagar] = useState(false);

  async function apagar() {
    if (!confirm(`Apagar esta paragem (cliente ${paragem.cliente})? Esta ação é irreversível.`))
      return;
    setAApagar(true);
    try {
      const res = await fetch(`/api/paragens/${paragem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.erro || "Erro ao apagar.");
        setAApagar(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Erro de ligação.");
      setAApagar(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => setAberto(true)}
        className="rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand/5"
      >
        Editar
      </button>
      <button
        onClick={apagar}
        disabled={aApagar}
        className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        {aApagar ? "…" : "Apagar"}
      </button>
      {aberto && (
        <ParagemEditor
          paragem={paragem}
          zonas={zonas}
          veiculos={veiculos}
          valorNoite={valorNoite}
          pesoMedioPaleteA={pesoMedioPaleteA}
          pesoMedioPaleteB={pesoMedioPaleteB}
          mostrarReceita
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}
