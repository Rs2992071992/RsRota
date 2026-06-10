"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  paragemId: number;
  pago: boolean;
}

/**
 * Checkbox "Pago" para uma paragem (escritório). Faz PATCH otimista do estado de
 * cobrança e refresca a página. Reutilizado na carta Cobranças da rota e na página
 * global de contas a receber.
 */
export default function PagoToggle({ paragemId, pago }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(pago);
  const [aGravar, setAGravar] = useState(false);

  async function alternar(novo: boolean) {
    setValor(novo); // otimista
    setAGravar(true);
    try {
      const res = await fetch(`/api/paragens/${paragemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pago: novo }),
      });
      if (!res.ok) {
        setValor(!novo); // reverte
        const data = await res.json().catch(() => ({}));
        alert(data.erro || "Erro ao atualizar o pagamento.");
        return;
      }
      router.refresh();
    } catch {
      setValor(!novo);
      alert("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={valor}
        disabled={aGravar}
        onChange={(e) => alternar(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
      />
      <span className={valor ? "font-medium text-green-700" : "text-gray-600"}>
        {valor ? "Pago" : "Pago?"}
      </span>
    </label>
  );
}
