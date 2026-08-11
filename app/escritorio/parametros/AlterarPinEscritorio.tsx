"use client";

import { useState } from "react";

export default function AlterarPinEscritorio() {
  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "ok" | "erro">("idle");
  const [erro, setErro] = useState("");

  async function guardar() {
    setErro("");
    setEstado("a-gravar");
    try {
      const res = await fetch("/api/auth/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinAtual, pinNovo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao alterar o PIN.");
        setEstado("erro");
        return;
      }
      setPinAtual("");
      setPinNovo("");
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 2000);
    } catch {
      setErro("Erro de ligação.");
      setEstado("erro");
    }
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Segurança — Alterar PIN do Escritório</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">PIN atual</label>
          <input
            type="password"
            inputMode="numeric"
            className="input"
            value={pinAtual}
            onChange={(e) => setPinAtual(e.target.value)}
            placeholder="••••"
          />
        </div>
        <div>
          <label className="label">Novo PIN (mín. 4 dígitos)</label>
          <input
            type="password"
            inputMode="numeric"
            className="input"
            value={pinNovo}
            onChange={(e) => setPinNovo(e.target.value)}
            placeholder="••••"
          />
        </div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        onClick={guardar}
        disabled={estado === "a-gravar" || !pinAtual || pinNovo.trim().length < 4}
        className="btn"
      >
        {estado === "a-gravar" ? "A guardar…" : estado === "ok" ? "✓ PIN alterado" : "Alterar PIN"}
      </button>
    </div>
  );
}
