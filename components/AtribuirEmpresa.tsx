"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NomeClienteResumo } from "@/lib/clientes-service";
import type { EmpresaOpt } from "@/lib/empresas-service";

interface Props {
  nomes: NomeClienteResumo[];
  empresas: EmpresaOpt[];
  /** Nome do cliente -> nome da empresa já atribuída, para os que já têm. */
  mapaAtual: Record<string, string>;
}

/**
 * Ferramenta de atribuição de empresa-mãe (escritório): seleciona clientes e
 * atribui-os a uma empresa (a quem se cobra), para agrupar/subtotalizar em
 * Cobranças. Mesmo espírito do AgruparClientes.tsx, mas o destino é uma
 * empresa (dropdown), não um nome canónico livre.
 */
export default function AtribuirEmpresa({ nomes, empresas: empresasIniciais, mapaAtual: mapaInicial }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [empresas, setEmpresas] = useState(empresasIniciais);
  const [mapa, setMapa] = useState(mapaInicial);
  const [empresaId, setEmpresaId] = useState("");
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [aCriarEmpresa, setACriarEmpresa] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  const lista = useMemo(
    () => (q.trim() ? nomes.filter((n) => n.nome.toLowerCase().includes(q.trim().toLowerCase())) : nomes),
    [nomes, q],
  );

  function alternar(nome: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(nome)) novo.delete(nome);
      else novo.add(nome);
      return novo;
    });
  }

  // Sugestão por prefixo: compara os primeiros carateres do nome (sem espaços/
  // hífens) com o início do nome da empresa escolhida — pré-marca para revisão,
  // nunca atribui sozinho. Apanha variantes tipo "Blow-egiquimica" para
  // "Blowtec" (ambos começam por "blo").
  function sugerirPorPrefixo() {
    const empresa = empresas.find((e) => String(e.id) === empresaId);
    if (!empresa) return;
    const prefixo = empresa.nome.toLowerCase().slice(0, 3);
    setSelecionados((prev) => {
      const novo = new Set(prev);
      for (const n of nomes) {
        const chave = n.nome.toLowerCase().replace(/[\s-]+/g, "");
        if (chave.startsWith(prefixo)) novo.add(n.nome);
      }
      return novo;
    });
  }

  async function criarEmpresa() {
    if (!novaEmpresa.trim()) return;
    setErro("");
    setACriarEmpresa(true);
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novaEmpresa.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao criar empresa.");
        return;
      }
      setEmpresas((prev) => [...prev, data.empresa].sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
      setEmpresaId(String(data.empresa.id));
      setNovaEmpresa("");
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setACriarEmpresa(false);
    }
  }

  async function atribuir() {
    const selecionadosArr = [...selecionados];
    if (selecionadosArr.length === 0 || !empresaId) return;
    const empresa = empresas.find((e) => String(e.id) === empresaId);
    if (!empresa) return;
    const confirmado = confirm(
      `Vais atribuir ${selecionadosArr.length} cliente(s) a "${empresa.nome}". Continuar?`,
    );
    if (!confirmado) return;

    setErro("");
    setAGravar(true);
    try {
      const res = await fetch("/api/clientes/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomes: selecionadosArr, empresaId: Number(empresaId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao atribuir.");
        return;
      }
      setMapa((prev) => {
        const novo = { ...prev };
        for (const nome of selecionadosArr) novo[nome] = empresa.nome;
        return novo;
      });
      setSelecionados(new Set());
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

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
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {mapa[n.nome] ?? <span className="text-gray-300">sem empresa</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Empresa (para onde atribuir)</label>
          <div className="flex gap-2">
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">— escolher —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={!empresaId}
              onClick={sugerirPorPrefixo}
            >
              Sugerir por prefixo
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Ou criar empresa nova</label>
            <input
              className="input"
              value={novaEmpresa}
              onChange={(e) => setNovaEmpresa(e.target.value)}
              placeholder="Ex.: Nome da empresa"
            />
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            disabled={aCriarEmpresa || !novaEmpresa.trim()}
            onClick={criarEmpresa}
          >
            {aCriarEmpresa ? "A criar…" : "+ Criar"}
          </button>
        </div>

        {selecionados.size > 0 && (
          <p className="text-sm text-gray-600">{selecionados.size} cliente(s) selecionado(s).</p>
        )}

        <button className="btn" disabled={aGravar || selecionados.size === 0 || !empresaId} onClick={atribuir}>
          {aGravar ? "A atribuir…" : "Atribuir"}
        </button>
      </div>
    </div>
  );
}
