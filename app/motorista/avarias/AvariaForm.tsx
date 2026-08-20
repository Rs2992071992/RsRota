"use client";

import { useMemo, useState } from "react";
import { fmtData } from "@/lib/format";

export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
}

export interface ItemAvaria {
  id: number;
  texto: string;
  resolvido: boolean;
}

export interface AvariaPendente {
  id: number;
  veiculoId: number;
  data: string; // ISO
  itens: ItemAvaria[];
  observacoes: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export default function AvariaForm({
  veiculos,
  avariasPendentes,
}: {
  veiculos: VeiculoOpcao[];
  avariasPendentes: AvariaPendente[];
}) {
  const [veiculoId, setVeiculoId] = useState(veiculos.length === 1 ? String(veiculos[0].id) : "");
  const [data, setData] = useState(hoje());
  const [situacoes, setSituacoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [ultimoPedido, setUltimoPedido] = useState<{ veiculo: string; data: string; itens: string[] } | null>(
    null,
  );
  const [pendentes, setPendentes] = useState(avariasPendentes);
  const [aAtualizar, setAAtualizar] = useState<number | null>(null);

  const pendentesDoVeiculo = useMemo(
    () => pendentes.filter((a) => String(a.veiculoId) === veiculoId),
    [pendentes, veiculoId],
  );

  function linhas(): string[] {
    return situacoes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!veiculoId) e.veiculoId = "Escolha o veículo";
    if (!data) e.data = "Obrigatório";
    if (linhas().length === 0) e.situacoes = "Escreva pelo menos uma situação";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!validar()) return;
    setAGravar(true);
    try {
      const itensTexto = linhas();
      const res = await fetch("/api/avarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          veiculoId: Number(veiculoId),
          data,
          itens: itensTexto,
          observacoes: observacoes.trim() || undefined,
        }),
      });
      const resposta = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: resposta.erro || "Erro ao gravar." });
        return;
      }
      setMsg({
        tipo: "ok",
        texto: "Pedido de manutenção reportado. O escritório vai vê-lo em Veículos → Pedido Manutenção.",
      });
      const veiculo = veiculos.find((v) => String(v.id) === veiculoId);
      setUltimoPedido({
        veiculo: veiculo ? veiculo.nome + (veiculo.matricula ? ` (${veiculo.matricula})` : "") : "",
        data,
        itens: itensTexto,
      });
      setPendentes((prev) => [
        {
          id: resposta.avaria.id,
          veiculoId: Number(veiculoId),
          data: resposta.avaria.data,
          itens: resposta.avaria.itens,
          observacoes: resposta.avaria.observacoes,
        },
        ...prev,
      ]);
      setSituacoes("");
      setObservacoes("");
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de ligação." });
    } finally {
      setAGravar(false);
    }
  }

  async function alternarItem(avariaId: number, item: ItemAvaria) {
    setAAtualizar(item.id + avariaId * 100000);
    try {
      const res = await fetch(`/api/avarias/${avariaId}/itens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvido: !item.resolvido }),
      });
      if (!res.ok) return;
      setPendentes((prev) =>
        prev.map((a) =>
          a.id !== avariaId
            ? a
            : { ...a, itens: a.itens.map((i) => (i.id === item.id ? { ...i, resolvido: !item.resolvido } : i)) },
        ),
      );
    } finally {
      setAAtualizar(null);
    }
  }

  function mailtoPedido(p: { veiculo: string; data: string; itens: string[] }): string {
    const assunto = `Pedido de Manutenção — ${p.veiculo}`;
    const corpo =
      `Veículo: ${p.veiculo}\nData: ${fmtData(p.data)}\n\nSituações:\n` +
      p.itens.map((i) => `- ${i}`).join("\n");
    return `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }

  return (
    <form onSubmit={submeter} className="space-y-4 pb-10">
      {msg && (
        <div
          className={`rounded-lg p-3 text-sm ${
            msg.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          <p>{msg.texto}</p>
          {msg.tipo === "ok" && ultimoPedido && (
            <a href={mailtoPedido(ultimoPedido)} className="mt-1 inline-block font-medium underline">
              Enviar email sobre este pedido de manutenção
            </a>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
            {erros.data && <p className="mt-1 text-xs text-red-600">{erros.data}</p>}
          </div>
          <div>
            <label className="label">Veículo</label>
            <select
              className="input"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              disabled={veiculos.length === 0}
            >
              <option value="">{veiculos.length === 0 ? "Sem veículos" : "— escolher —"}</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                  {v.matricula ? ` (${v.matricula})` : ""}
                </option>
              ))}
            </select>
            {erros.veiculoId && <p className="mt-1 text-xs text-red-600">{erros.veiculoId}</p>}
          </div>
        </div>

        <div>
          <label className="label">Situações a resolver (uma por linha)</label>
          <textarea
            className="input"
            rows={5}
            value={situacoes}
            onChange={(e) => setSituacoes(e.target.value)}
            placeholder={"Ex.:\ntravões a fazer ruído\nluz avaria no painel\ntrocar pneu direito"}
          />
          {erros.situacoes && <p className="mt-1 text-xs text-red-600">{erros.situacoes}</p>}
        </div>

        <div>
          <label className="label">Observações (opcional)</label>
          <textarea
            className="input"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Alguma nota extra que não seja uma situação a marcar…"
          />
        </div>
      </div>

      {pendentesDoVeiculo.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p className="mb-2 font-medium">
            Já há pedidos de manutenção por resolver reportados para este veículo — vá confirmando o que já
            foi feito:
          </p>
          <div className="space-y-3">
            {pendentesDoVeiculo.map((a) => (
              <div key={a.id} className="rounded-md bg-white/60 p-2">
                <p className="mb-1 text-xs font-medium text-amber-700">{fmtData(a.data)}</p>
                <ul className="space-y-1">
                  {a.itens.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={item.resolvido}
                          disabled={aAtualizar === item.id + a.id * 100000}
                          onChange={() => alternarItem(a.id, item)}
                        />
                        <span className={item.resolvido ? "text-gray-400 line-through" : ""}>{item.texto}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {a.observacoes && <p className="mt-1 text-xs italic text-amber-700">Obs.: {a.observacoes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="submit" disabled={aGravar} className="btn w-full">
        {aGravar ? "A gravar…" : "Reportar pedido de manutenção"}
      </button>
    </form>
  );
}
