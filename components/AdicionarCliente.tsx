"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Adiciona um cliente novo (só o nome) antes de ele ter qualquer paragem ou
 * orçamento — cria a ficha via PATCH /api/clientes (upsert por nome, mesmo
 * endpoint já usado por ContatoCliente) e abre logo o detalhe desse cliente,
 * pronto a preencher o resto do contacto.
 */
export default function AdicionarCliente() {
  const router = useRouter();
  const [aAbrir, setAAbrir] = useState(false);
  const [nome, setNome] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  async function criar() {
    const alvo = nome.trim();
    if (!alvo) {
      setErro("Indique o nome.");
      return;
    }
    setErro("");
    setAGravar(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: alvo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao criar o cliente.");
        return;
      }
      setAAbrir(false);
      setNome("");
      router.push(`/escritorio/clientes?cliente=${encodeURIComponent(alvo)}`);
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  if (!aAbrir) {
    return (
      <button
        type="button"
        onClick={() => setAAbrir(true)}
        className="text-sm font-medium text-brand hover:underline"
      >
        + Adicionar cliente
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input w-48"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do cliente"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && criar()}
      />
      <button onClick={criar} disabled={aGravar} className="btn-secondary whitespace-nowrap text-sm">
        {aGravar ? "A criar…" : "Criar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setAAbrir(false);
          setNome("");
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
