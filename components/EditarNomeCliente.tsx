"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Nome do cliente com opção de editar. Reaproveita POST /api/clientes/agrupar
 * (funde o nome atual, como única "variante", no novo nome canónico) em vez
 * de um rename cru — assim rotas, orçamentos e pedidos de paletes antigos com
 * o nome antigo continuam ligados à ficha depois de renomear.
 */
export default function EditarNomeCliente({ nome }: { nome: string }) {
  const router = useRouter();
  const [aEditar, setAEditar] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState("");

  async function guardar() {
    const alvo = novoNome.trim();
    if (!alvo) {
      setErro("Indique o nome.");
      return;
    }
    if (alvo.toLowerCase() === nome.toLowerCase()) {
      setAEditar(false);
      return;
    }
    setErro("");
    setAGuardar(true);
    try {
      const res = await fetch("/api/clientes/agrupar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomesVariantes: [nome], nomeCanonico: alvo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao renomear.");
        return;
      }
      router.push(`/escritorio/clientes?cliente=${encodeURIComponent(alvo)}`);
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGuardar(false);
    }
  }

  if (aEditar) {
    return (
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          className="input"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          autoFocus
        />
        <button onClick={guardar} disabled={aGuardar} className="btn-secondary whitespace-nowrap text-sm">
          {aGuardar ? "A guardar…" : "Guardar"}
        </button>
        <button
          onClick={() => {
            setAEditar(false);
            setNovoNome(nome);
            setErro("");
          }}
          className="whitespace-nowrap text-sm text-gray-400 hover:text-gray-700"
        >
          Cancelar
        </button>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xl font-bold">{nome}</h2>
      <button
        onClick={() => setAEditar(true)}
        title="Editar nome deste cliente"
        className="text-gray-400 hover:text-gray-700"
      >
        ✎
      </button>
    </div>
  );
}
