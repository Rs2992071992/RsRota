"use client";

import { useMemo, useState } from "react";
import { fmtData } from "@/lib/format";

export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
}

export interface AvariaPendente {
  id: number;
  veiculoId: number;
  data: string; // ISO
  descricao: string;
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
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [ultimaAvaria, setUltimaAvaria] = useState<{ veiculo: string; data: string; descricao: string } | null>(
    null,
  );

  const pendentesDoVeiculo = useMemo(
    () => avariasPendentes.filter((a) => String(a.veiculoId) === veiculoId),
    [avariasPendentes, veiculoId],
  );

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!veiculoId) e.veiculoId = "Escolha o veículo";
    if (!data) e.data = "Obrigatório";
    if (!descricao.trim()) e.descricao = "Descreva o problema";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!validar()) return;
    setAGravar(true);
    try {
      const res = await fetch("/api/avarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veiculoId: Number(veiculoId), data, descricao: descricao.trim() }),
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
      setUltimaAvaria({
        veiculo: veiculo ? veiculo.nome + (veiculo.matricula ? ` (${veiculo.matricula})` : "") : "",
        data,
        descricao: descricao.trim(),
      });
      setDescricao("");
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de ligação." });
    } finally {
      setAGravar(false);
    }
  }

  function mailtoAvaria(a: { veiculo: string; data: string; descricao: string }): string {
    const assunto = `Pedido de Manutenção — ${a.veiculo}`;
    const corpo = `Veículo: ${a.veiculo}\nData: ${fmtData(a.data)}\n\nDescrição:\n${a.descricao}`;
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
          {msg.tipo === "ok" && ultimaAvaria && (
            <a href={mailtoAvaria(ultimaAvaria)} className="mt-1 inline-block font-medium underline">
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
          <label className="label">Descrição do problema</label>
          <textarea
            className="input"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: travões a fazer ruído, luz avaria no painel…"
          />
          {erros.descricao && <p className="mt-1 text-xs text-red-600">{erros.descricao}</p>}
        </div>
      </div>

      {pendentesDoVeiculo.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p className="mb-1 font-medium">
            Já há pedidos de manutenção por resolver reportados para este veículo:
          </p>
          <ul className="list-inside list-disc space-y-1">
            {pendentesDoVeiculo.map((a) => (
              <li key={a.id}>
                {fmtData(a.data)} — {a.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={aGravar} className="btn w-full">
        {aGravar ? "A gravar…" : "Reportar pedido de manutenção"}
      </button>
    </form>
  );
}
