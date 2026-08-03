"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface CarregamentoBD {
  id: number;
  data: string;
  estado: string;
  veiculoNome: string;
  veiculoMatricula: string | null;
  reboqueNome: string | null;
  nPedidos: number;
}

export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
}

export default function CargasManager({
  carregamentos,
  veiculos,
}: {
  carregamentos: CarregamentoBD[];
  veiculos: VeiculoOpcao[];
}) {
  const router = useRouter();
  const [aCriar, setACriar] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cargas</h1>
        <div className="flex gap-2">
          <Link href="/escritorio/reboques" className="btn-secondary text-sm">Gerir reboques</Link>
          <button onClick={() => setACriar(true)} className="btn">+ Novo carregamento</button>
        </div>
      </div>

      {carregamentos.length === 0 ? (
        <div className="card text-sm text-gray-500">
          Ainda não há carregamentos. Crie o primeiro com “Novo carregamento”.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {carregamentos.map((c) => (
            <Link
              key={c.id}
              href={`/escritorio/cargas/${c.id}`}
              className="card block transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.veiculoNome}</span>
                <span
                  className={`text-xs ${c.estado === "ABERTO" ? "text-green-600" : "text-gray-400"}`}
                >
                  {c.estado === "ABERTO" ? "Aberto" : "Fechado"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {c.veiculoMatricula || "sem matrícula"}
                {c.reboqueNome ? ` · reboque: ${c.reboqueNome}` : ""}
              </p>
              <p className="mt-1 text-sm">{c.nPedidos} pedido(s)</p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(c.data).toLocaleDateString("pt-PT")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {aCriar && (
        <NovoCarregamentoModal
          veiculos={veiculos}
          onClose={() => setACriar(false)}
          onSaved={(id) => router.push(`/escritorio/cargas/${id}`)}
        />
      )}
    </div>
  );
}

function NovoCarregamentoModal({
  veiculos,
  onClose,
  onSaved,
}: {
  veiculos: VeiculoOpcao[];
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [veiculoId, setVeiculoId] = useState<number | "">(veiculos[0]?.id ?? "");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<"idle" | "a-gravar">("idle");
  const [erro, setErro] = useState("");

  const veiculoEscolhido = veiculos.find((v) => v.id === veiculoId);
  const semCaixa =
    veiculoEscolhido && (veiculoEscolhido.caixaComprimentoMm == null || veiculoEscolhido.caixaLarguraMm == null);

  async function guardar() {
    setErro("");
    if (!veiculoId) {
      setErro("Escolha um veículo.");
      return;
    }
    setEstado("a-gravar");
    try {
      const res = await fetch("/api/carregamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veiculoId, notas: notas.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao criar.");
        setEstado("idle");
        return;
      }
      const { carregamento } = await res.json();
      onSaved(carregamento.id);
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Novo carregamento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        {veiculos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Não há veículos ativos. Crie um em <strong>Veículos</strong> primeiro.
          </p>
        ) : (
          <>
            <div>
              <label className="label">Veículo</label>
              <select
                className="input"
                value={veiculoId}
                onChange={(e) => setVeiculoId(Number(e.target.value))}
              >
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome} {v.matricula ? `(${v.matricula})` : ""}
                  </option>
                ))}
              </select>
              {semCaixa && (
                <p className="mt-1 text-xs text-amber-600">
                  Este veículo ainda não tem a caixa (mm) configurada — a planta de carga só fica
                  disponível depois de a preencher em Veículos.
                </p>
              )}
            </div>
            <div className="mt-3">
              <label className="label">Notas (opcional)</label>
              <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={estado !== "idle" || veiculos.length === 0} className="btn">
            {estado === "a-gravar" ? "A criar…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
