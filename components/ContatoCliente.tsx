"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactoCliente } from "@/lib/clientes-service";

interface Props {
  nome: string;
  contacto: ContactoCliente | null;
}

const vazio: ContactoCliente = {
  contato: null,
  telefone: null,
  email: null,
  morada: null,
  notas: null,
};

/**
 * Carta de contacto de um cliente (escritório). Mostra os dados em leitura e, ao
 * carregar em "Editar", abre um formulário inline que faz PATCH /api/clientes
 * (upsert por nome) e refresca a página. Não toca em nenhum cálculo.
 */
export default function ContatoCliente({ nome, contacto }: Props) {
  const router = useRouter();
  const [editar, setEditar] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [f, setF] = useState<ContactoCliente>(contacto ?? vazio);

  const c = contacto ?? vazio;
  const vazioTotal = !c.contato && !c.telefone && !c.email && !c.morada && !c.notas;
  const set = (k: keyof ContactoCliente, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function guardar() {
    setAGravar(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, ...f }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.erro || "Erro ao guardar o contacto.");
        return;
      }
      setEditar(false);
      router.refresh();
    } catch {
      alert("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  if (editar) {
    return (
      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Contacto (pessoa)</label>
            <input className="input" value={f.contato ?? ""} onChange={(e) => set("contato", e.target.value)} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={f.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">Morada</label>
            <input className="input" value={f.morada ?? ""} onChange={(e) => set("morada", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notas</label>
          <textarea className="input" rows={2} value={f.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={guardar} disabled={aGravar}>
            {aGravar ? "A guardar…" : "Guardar"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setF(contacto ?? vazio);
              setEditar(false);
            }}
            disabled={aGravar}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Contacto</h3>
        <button className="text-xs font-medium text-brand hover:underline" onClick={() => setEditar(true)}>
          {vazioTotal ? "Adicionar contacto" : "Editar"}
        </button>
      </div>
      {vazioTotal ? (
        <p className="mt-2 text-sm text-gray-400">Sem ficha de contacto.</p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
          {c.contato && (
            <Linha rotulo="Pessoa" valor={c.contato} />
          )}
          {c.telefone && (
            <Linha rotulo="Telefone" valor={<a className="text-brand hover:underline" href={`tel:${c.telefone}`}>{c.telefone}</a>} />
          )}
          {c.email && (
            <Linha rotulo="Email" valor={<a className="text-brand hover:underline" href={`mailto:${c.email}`}>{c.email}</a>} />
          )}
          {c.morada && <Linha rotulo="Morada" valor={c.morada} />}
          {c.notas && <Linha rotulo="Notas" valor={c.notas} />}
        </dl>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-gray-500">{rotulo}:</dt>
      <dd className="font-medium text-gray-800">{valor}</dd>
    </div>
  );
}
