"use client";

import { useState } from "react";
import Link from "next/link";

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Cria um pedido de manutenção (Avaria) para UM veículo já conhecido — versão
 * "de secretária" do formulário do motorista (`app/motorista/avarias/AvariaForm.tsx`,
 * que pede para escolher o veículo). Serve de lembrete: o escritório escreve a
 * checklist do que quer verificar/mandar reparar, e o pedido fica em
 * /escritorio/veiculos/avarias para se ir confirmando o que já foi feito
 * (mesma tabela usada para os pedidos reportados pelos motoristas).
 */
export default function PedidoManutencaoModal({
  veiculoId,
  veiculoNome,
  onClose,
  onCreated,
}: {
  veiculoId: number;
  veiculoNome: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [data, setData] = useState(hoje());
  const [situacoes, setSituacoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [criado, setCriado] = useState(false);

  function linhas(): string[] {
    return situacoes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (linhas().length === 0) {
      setErro("Escreva pelo menos uma situação a verificar.");
      return;
    }
    setAGravar(true);
    try {
      const res = await fetch("/api/avarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veiculoId, data, itens: linhas(), observacoes: observacoes.trim() || undefined }),
      });
      if (!res.ok) {
        const resposta = await res.json().catch(() => ({}));
        setErro(resposta.erro || "Erro ao gravar.");
        return;
      }
      setCriado(true);
      onCreated?.();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Pedido de manutenção — {veiculoNome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {criado ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              Pedido criado. Fica como lembrete em{" "}
              <Link href="/escritorio/veiculos/avarias" className="font-medium underline">
                Pedidos de Manutenção
              </Link>{" "}
              para ires marcando o que já foi verificado/reparado.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn">Fechar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submeter} className="space-y-3">
            {erro && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

            <div>
              <label className="label">Data</label>
              <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
            </div>

            <div>
              <label className="label">Situações a verificar (uma por linha)</label>
              <textarea
                className="input"
                rows={5}
                value={situacoes}
                onChange={(e) => setSituacoes(e.target.value)}
                placeholder={"Ex.:\nver óleo e filtros\nverificar travões\npneus/pressão"}
              />
            </div>

            <div>
              <label className="label">Observações (opcional)</label>
              <textarea
                className="input"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={aGravar} className="btn">
                {aGravar ? "A gravar…" : "Criar pedido"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
