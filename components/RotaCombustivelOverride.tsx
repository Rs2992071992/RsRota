"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  idRota: string;
  /** Valor atual comum a todas as paragens da rota (null = a usar o padrão, ou valores mistos). */
  valorAtual: number | null;
  /** Preço de referência global (Parâmetros), mostrado como padrão. */
  precoParametro: number;
}

/**
 * Corrige o preço de ref. combustível de UMA rota inteira de uma vez (todas as
 * paragens), sem editar paragem a paragem. Deixar vazio remove o override e a
 * rota volta a usar o valor global de Parâmetros.
 */
export default function RotaCombustivelOverride({ idRota, valorAtual, precoParametro }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(valorAtual != null ? String(valorAtual) : "");
  const [aGravar, setAGravar] = useState(false);

  async function gravar() {
    const texto = valor.trim();
    const numero = texto === "" ? null : Number(texto);
    if (numero != null && (Number.isNaN(numero) || numero < 0)) {
      alert("Preço inválido.");
      return;
    }
    setAGravar(true);
    try {
      const res = await fetch(`/api/rotas/${encodeURIComponent(idRota)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precoCombRefOverride: numero }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.erro || "Erro ao gravar o preço.");
        return;
      }
      router.refresh();
    } catch {
      alert("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">Preço ref. combustível desta rota (€/L)</label>
        <input
          type="number"
          step="any"
          min={0}
          placeholder={`Padrão: ${precoParametro}`}
          className="input w-40"
          value={valor}
          disabled={aGravar}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>
      <button type="button" onClick={gravar} disabled={aGravar} className="btn-secondary">
        {aGravar ? "A gravar…" : "Guardar"}
      </button>
    </div>
  );
}
