"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botão de apagar um orçamento (com confirmação). Usado na lista. */
export default function ApagarOrcamento({ id, numero }: { id: number; numero: string }) {
  const router = useRouter();
  const [aApagar, setAApagar] = useState(false);

  async function apagar() {
    if (!confirm(`Apagar o orçamento ${numero}? Esta ação não pode ser anulada.`)) return;
    setAApagar(true);
    try {
      const res = await fetch(`/api/devis/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.erro || "Erro ao apagar.");
        return;
      }
      router.refresh();
    } catch {
      alert("Erro de ligação.");
    } finally {
      setAApagar(false);
    }
  }

  return (
    <button
      onClick={apagar}
      disabled={aApagar}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {aApagar ? "A apagar…" : "Apagar"}
    </button>
  );
}
