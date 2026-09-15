"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Apaga a ficha de um cliente sem histórico real (ex.: variante que o
 * motorista escreveu por engano e que a admin já corrigiu nas paragens
 * reais, mas que ficou lá a ocupar espaço na lista). O servidor recusa se
 * ainda houver paragens/orçamentos/pedidos de paletes com este nome — nesse
 * caso o caminho certo é "Editar nome" (funde tudo no nome certo), não apagar.
 */
export default function ApagarCliente({ nome }: { nome: string }) {
  const router = useRouter();
  const [aApagar, setAApagar] = useState(false);

  async function apagar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Apagar "${nome}" da lista de clientes?`)) return;
    setAApagar(true);
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(nome)}`, { method: "DELETE" });
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
      title="Apagar este cliente"
      className="shrink-0 text-gray-300 hover:text-red-600"
    >
      {aApagar ? "…" : "✕"}
    </button>
  );
}
