"use client";

import { useState } from "react";

export default function AlterarPinMotorista({ id, codigo }: { id: number; codigo: string }) {
  const [pin, setPin] = useState("");
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "ok" | "erro">("idle");
  const [erro, setErro] = useState("");

  async function guardar() {
    setErro("");
    setEstado("a-gravar");
    try {
      const res = await fetch(`/api/motoristas/${id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao alterar o PIN.");
        setEstado("erro");
        return;
      }
      setPin("");
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 2000);
    } catch {
      setErro("Erro de ligação.");
      setEstado("erro");
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Alterar PIN</h2>
      <p className="text-xs text-gray-500">
        O motorista usa este PIN para entrar na app (com o ID <strong>{codigo}</strong>).
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Novo PIN (mín. 4 dígitos)</label>
          <input
            type="password"
            inputMode="numeric"
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
        </div>
        <button
          onClick={guardar}
          disabled={estado === "a-gravar" || pin.trim().length < 4}
          className="btn"
        >
          {estado === "a-gravar" ? "A guardar…" : estado === "ok" ? "✓ Alterado" : "Alterar"}
        </button>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
