"use client";

import { useMemo, useState } from "react";

// Mesmo valor especial de lib/folha-motorista-service.ts (não se importa de lá
// para não puxar o Prisma para o bundle do browser).
const SEM_EMPRESA = "__sem_empresa__";

export default function FolhaForm({
  empresas,
  veiculos,
  deInicial,
  ateInicial,
}: {
  empresas: string[];
  veiculos: { id: number; nome: string }[];
  deInicial: string;
  ateInicial: string;
}) {
  const [de, setDe] = useState(deInicial);
  const [ate, setAte] = useState(ateInicial);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [veiculoId, setVeiculoId] = useState("");
  const [preco, setPreco] = useState(false);
  const [aGerar, setAGerar] = useState<"pdf" | "xlsx" | null>(null);
  const [erro, setErro] = useState("");

  const todas = [...empresas, SEM_EMPRESA];
  const rotulo = (e: string) => (e === SEM_EMPRESA ? "Sem empresa atribuída" : e);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    if (escolhidas.size > 0) p.set("empresas", [...escolhidas].join(","));
    if (veiculoId) p.set("veiculoId", veiculoId);
    p.set("preco", preco ? "1" : "0");
    return p;
  }, [de, ate, escolhidas, veiculoId, preco]);

  function alternar(e: string) {
    setEscolhidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(e)) novo.delete(e);
      else novo.add(e);
      return novo;
    });
  }

  async function descarregar(formato: "pdf" | "xlsx") {
    setErro("");
    if (de && ate && de > ate) return setErro("A data inicial é depois da final.");
    setAGerar(formato);
    try {
      const p = new URLSearchParams(query);
      p.set("formato", formato);
      const res = await fetch(`/api/folha-motorista?${p.toString()}`);
      if (!res.ok) return setErro("Erro ao gerar a folha.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `folha-registo.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGerar(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">De</label>
          <input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div>
          <label className="label">Camião</label>
          <select className="input" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
            <option value="">Todos</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0">Empresas-mãe</label>
          <button
            type="button"
            className="text-xs text-brand hover:underline"
            onClick={() => setEscolhidas(escolhidas.size === todas.length ? new Set() : new Set(todas))}
          >
            {escolhidas.size === todas.length ? "Limpar" : "Selecionar todas"}
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          Sem nenhuma escolhida, entram todas. Só entram as paragens de clientes dessas empresas.
        </p>
        <div className="flex flex-wrap gap-2">
          {todas.map((e) => (
            <label
              key={e}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                escolhidas.has(e) ? "border-brand bg-brand/5 font-medium text-brand" : "border-gray-200 text-gray-700"
              }`}
            >
              <input type="checkbox" checked={escolhidas.has(e)} onChange={() => alternar(e)} />
              {rotulo(e)}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={preco} onChange={(e) => setPreco(e.target.checked)} />
        Mostrar o preço do gasóleo (€/L)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={aGerar !== null} onClick={() => descarregar("pdf")}>
          {aGerar === "pdf" ? "A gerar…" : "Descarregar PDF"}
        </button>
        <button className="btn-secondary" disabled={aGerar !== null} onClick={() => descarregar("xlsx")}>
          {aGerar === "xlsx" ? "A gerar…" : "Descarregar Excel"}
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </div>
  );
}
