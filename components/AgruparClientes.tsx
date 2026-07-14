"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NomeClienteResumo } from "@/lib/clientes-service";

interface Props {
  nomes: NomeClienteResumo[];
}

/**
 * Ferramenta de agrupamento de clientes (escritório): permite selecionar
 * várias variantes de nome e fundi-las num nome canónico. Atualiza logo o
 * histórico existente e grava um alias para futuras importações não voltarem
 * a fragmentar (ver POST /api/clientes/agrupar).
 */
export default function AgruparClientes({ nomes }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [nomeCanonico, setNomeCanonico] = useState("");
  const [aGravar, setAGravar] = useState(false);

  const lista = useMemo(
    () => (q.trim() ? nomes.filter((n) => n.nome.toLowerCase().includes(q.trim().toLowerCase())) : nomes),
    [nomes, q],
  );

  const totais = useMemo(() => {
    let nParagens = 0;
    let nDevis = 0;
    for (const nome of selecionados) {
      const r = nomes.find((n) => n.nome === nome);
      if (r) {
        nParagens += r.nParagens;
        nDevis += r.nDevis;
      }
    }
    return { nParagens, nDevis };
  }, [nomes, selecionados]);

  function alternar(nome: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(nome)) novo.delete(nome);
      else novo.add(nome);
      return novo;
    });
  }

  async function agrupar() {
    const nomesVariantes = [...selecionados];
    if (nomesVariantes.length === 0 || !nomeCanonico.trim()) return;
    const confirmado = confirm(
      `Vais mover ${totais.nParagens} paragem(ns) e ${totais.nDevis} orçamento(s) para "${nomeCanonico.trim()}". Continuar?`,
    );
    if (!confirmado) return;

    setAGravar(true);
    try {
      const res = await fetch("/api/clientes/agrupar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomesVariantes, nomeCanonico: nomeCanonico.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.erro || "Erro ao agrupar clientes.");
        return;
      }
      router.push(`/escritorio/clientes?cliente=${encodeURIComponent(nomeCanonico.trim())}`);
      router.refresh();
    } catch {
      alert("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-0">
        <div className="border-b border-gray-100 p-3">
          <input
            className="input"
            placeholder="Procurar nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto">
          {lista.length === 0 && <li className="px-3 py-4 text-sm text-gray-400">Sem clientes.</li>}
          {lista.map((n) => (
            <li key={n.nome}>
              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selecionados.has(n.nome)}
                    onChange={() => alternar(n.nome)}
                  />
                  <span className="font-medium">{n.nome}</span>
                  {n.temFicha && <span className="text-xs text-gray-400">(com ficha)</span>}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {n.nParagens} paragem(ns) · {n.nDevis} orçamento(s)
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Nome canónico (para onde agrupar)</label>
          <input
            list="nomes-clientes"
            className="input"
            value={nomeCanonico}
            onChange={(e) => setNomeCanonico(e.target.value)}
            placeholder="Ex.: Hilplas Tecfil"
          />
          <datalist id="nomes-clientes">
            {nomes.map((n) => (
              <option key={n.nome} value={n.nome} />
            ))}
          </datalist>
        </div>

        {selecionados.size > 0 && (
          <p className="text-sm text-gray-600">
            {selecionados.size} nome(s) selecionado(s) → {totais.nParagens} paragem(ns) e{" "}
            {totais.nDevis} orçamento(s) vão passar a "{nomeCanonico.trim() || "…"}".
          </p>
        )}

        <button
          className="btn"
          disabled={aGravar || selecionados.size === 0 || !nomeCanonico.trim()}
          onClick={agrupar}
        >
          {aGravar ? "A agrupar…" : "Agrupar"}
        </button>
      </div>
    </div>
  );
}
