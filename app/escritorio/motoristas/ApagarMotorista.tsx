"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApagarMotorista({ id, nome }: { id: number; nome: string }) {
  const router = useRouter();
  const [aApagar, setAApagar] = useState(false);

  async function apagar() {
    if (
      !confirm(
        `Apagar o motorista "${nome}"? As paragens dele são mantidas (ficam sem motorista associado).`,
      )
    )
      return;
    setAApagar(true);
    try {
      const res = await fetch(`/api/motoristas/${id}`, { method: "DELETE" });
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
