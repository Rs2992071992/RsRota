"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ReboqueBD {
  id: number;
  nome: string;
  matricula: string | null;
  comprimentoMm: number;
  larguraMm: number;
  ativo: boolean;
}

type ReboqueForm = { nome: string; matricula: string; comprimentoMm: number; larguraMm: number; ativo: boolean };

const FORM_VAZIO: ReboqueForm = { nome: "", matricula: "", comprimentoMm: 8150, larguraMm: 2480, ativo: true };

export default function ReboquesManager({ reboques }: { reboques: ReboqueBD[] }) {
  const router = useRouter();
  const [aEditar, setAEditar] = useState<ReboqueBD | null>(null);
  const [aCriar, setACriar] = useState(false);

  async function apagar(id: number) {
    if (!confirm("Apagar este reboque?")) return;
    const res = await fetch(`/api/reboques/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.erro || "Erro ao apagar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Link href="/escritorio/cargas" className="text-sm text-gray-500 hover:underline">
        ← Cargas
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reboques</h1>
        <button onClick={() => setACriar(true)} className="btn">+ Novo reboque</button>
      </div>

      {reboques.length === 0 ? (
        <div className="card text-sm text-gray-500">
          Ainda não há reboques. Crie o primeiro com “Novo reboque”.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reboques.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.nome}</span>
                {!r.ativo && <span className="text-xs text-gray-400">inativo</span>}
              </div>
              <p className="text-sm text-gray-500">{r.matricula || "sem matrícula"}</p>
              <p className="mt-1 text-sm">
                Caixa: <span className="font-bold">{r.comprimentoMm} × {r.larguraMm} mm</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setAEditar(r)} className="btn-secondary text-sm">Editar</button>
                <button onClick={() => apagar(r.id)} className="text-sm text-red-500 hover:text-red-700">Apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aCriar && (
        <ReboqueModal
          titulo="Novo reboque"
          inicial={FORM_VAZIO}
          onClose={() => setACriar(false)}
          onSubmit={async (f) => {
            const res = await fetch("/api/reboques", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...f, matricula: f.matricula.trim() || null }),
            });
            return res;
          }}
          onSaved={() => {
            setACriar(false);
            router.refresh();
          }}
        />
      )}

      {aEditar && (
        <ReboqueModal
          titulo={`Editar — ${aEditar.nome}`}
          inicial={{
            nome: aEditar.nome,
            matricula: aEditar.matricula ?? "",
            comprimentoMm: aEditar.comprimentoMm,
            larguraMm: aEditar.larguraMm,
            ativo: aEditar.ativo,
          }}
          onClose={() => setAEditar(null)}
          onSubmit={async (f) => {
            const res = await fetch(`/api/reboques/${aEditar.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...f, matricula: f.matricula.trim() || null }),
            });
            return res;
          }}
          onSaved={() => {
            setAEditar(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReboqueModal({
  titulo,
  inicial,
  onClose,
  onSubmit,
  onSaved,
}: {
  titulo: string;
  inicial: ReboqueForm;
  onClose: () => void;
  onSubmit: (f: ReboqueForm) => Promise<Response>;
  onSaved: () => void;
}) {
  const [f, setF] = useState<ReboqueForm>(inicial);
  const [estado, setEstado] = useState<"idle" | "a-gravar">("idle");
  const [erro, setErro] = useState("");

  async function guardar() {
    setErro("");
    if (!f.nome.trim()) {
      setErro("Nome obrigatório.");
      return;
    }
    setEstado("a-gravar");
    try {
      const res = await onSubmit(f);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao guardar.");
        setEstado("idle");
        return;
      }
      onSaved();
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Nome</label>
            <input className="input" value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Matrícula</label>
            <input className="input" value={f.matricula} onChange={(e) => setF((p) => ({ ...p, matricula: e.target.value }))} />
          </div>
          <div>
            <label className="label">Caixa — comprimento (mm)</label>
            <input
              type="number"
              step="any"
              className="input"
              value={f.comprimentoMm}
              onChange={(e) => setF((p) => ({ ...p, comprimentoMm: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Caixa — largura (mm)</label>
            <input
              type="number"
              step="any"
              className="input"
              value={f.larguraMm}
              onChange={(e) => setF((p) => ({ ...p, larguraMm: Number(e.target.value) }))}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="ativo"
              type="checkbox"
              checked={f.ativo}
              onChange={(e) => setF((p) => ({ ...p, ativo: e.target.checked }))}
            />
            <label htmlFor="ativo" className="label mb-0">Ativo</label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={estado !== "idle"} className="btn">
            {estado === "a-gravar" ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
