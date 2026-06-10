"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApagarRota({ idRota, nParagens }: { idRota: string; nParagens: number }) {
  const router = useRouter();
  const [aApagar, setAApagar] = useState(false);

  async function apagar() {
    if (
      !confirm(
        `Apagar a rota "${idRota}" e as suas ${nParagens} paragem(ns)? Esta ação é irreversível.`,
      )
    )
      return;
    setAApagar(true);
    try {
      const res = await fetch(`/api/rotas/${encodeURIComponent(idRota)}`, { method: "DELETE" });
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
    <button
      onClick={apagar}
      disabled={aApagar}
      className="font-medium text-red-600 hover:text-red-800"
    >
      {aApagar ? "…" : "Apagar"}
    </button>
  );
}
