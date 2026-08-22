"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtEuro, fmtData } from "@/lib/format";
import type { LinhaCobranca } from "@/lib/cobrancas-service";
import EstadoPagamentoBadge from "@/components/EstadoPagamentoBadge";
import PagoToggle from "@/components/PagoToggle";

const SEM_EMPRESA = "Sem empresa atribuída";

interface Grupo {
  empresa: string;
  linhas: LinhaCobranca[];
  porReceber: number;
  nVencidas: number;
}

/** Agrupa por empresa (ordem alfabética; "Sem empresa atribuída" sempre por último). */
function agrupar(linhas: LinhaCobranca[]): Grupo[] {
  const mapa = new Map<string, LinhaCobranca[]>();
  for (const l of linhas) {
    const chave = l.empresa ?? SEM_EMPRESA;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(l);
  }
  const grupos = [...mapa.entries()].map(([empresa, ls]) => ({
    empresa,
    linhas: ls,
    porReceber: ls.filter((l) => !l.pago).reduce((a, l) => a + l.valor, 0),
    nVencidas: ls.filter((l) => l.estado === "VENCIDO").length,
  }));
  grupos.sort((a, b) => {
    if (a.empresa === SEM_EMPRESA) return 1;
    if (b.empresa === SEM_EMPRESA) return -1;
    return a.empresa.localeCompare(b.empresa, "pt");
  });
  return grupos;
}

export default function CobrancasTabela({ linhas }: { linhas: LinhaCobranca[] }) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [aGerarPdf, setAGerarPdf] = useState(false);

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? linhas.filter(
        (l) =>
          l.cliente.toLowerCase().includes(termo) ||
          l.idRota.toLowerCase().includes(termo) ||
          (l.empresa ?? "").toLowerCase().includes(termo),
      )
    : linhas;
  const grupos = useMemo(() => agrupar(filtradas), [filtradas]);

  function alternar(id: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarGrupo(g: Grupo) {
    const todosSelecionados = g.linhas.every((l) => selecionados.has(l.id));
    setSelecionados((prev) => {
      const novo = new Set(prev);
      for (const l of g.linhas) {
        if (todosSelecionados) novo.delete(l.id);
        else novo.add(l.id);
      }
      return novo;
    });
  }

  // Se a seleção toda pertence à mesma empresa, usa o nome dela no PDF.
  const empresaDaSelecao = useMemo(() => {
    const linhasSel = linhas.filter((l) => selecionados.has(l.id));
    if (linhasSel.length === 0) return null;
    const primeira = linhasSel[0].empresa;
    return linhasSel.every((l) => l.empresa === primeira) ? primeira : null;
  }, [linhas, selecionados]);

  async function descarregarSelecaoPdf() {
    setAGerarPdf(true);
    try {
      const titulo = empresaDaSelecao || "Situação de conta — seleção";
      const res = await fetch("/api/cobrancas/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selecionados], titulo }),
      });
      if (!res.ok) {
        alert("Erro ao gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setAGerarPdf(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar cliente, rota ou empresa…"
          className="input max-w-xs"
        />
        {termo && (
          <span className="text-xs text-gray-500">
            {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
          </span>
        )}
        {selecionados.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-600">{selecionados.size} selecionada(s)</span>
            <button className="btn-secondary" disabled={aGerarPdf} onClick={descarregarSelecaoPdf}>
              {aGerarPdf ? "A gerar…" : "Descarregar PDF da seleção"}
            </button>
          </div>
        )}
      </div>

      {grupos.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">Sem resultados para “{busca.trim()}”.</p>
      )}

      <div className="space-y-6">
        {grupos.map((g) => {
          const todosSelecionados = g.linhas.every((l) => selecionados.has(l.id));
          return (
            <div key={g.empresa}>
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  {g.empresa}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {g.linhas.length} linha{g.linhas.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <p className="text-xs text-gray-600">
                  Por receber: <span className="font-semibold text-amber-700">{fmtEuro(g.porReceber)}</span>
                  {g.nVencidas > 0 && (
                    <span className="ml-2 font-semibold text-red-700">{g.nVencidas} vencida(s)</span>
                  )}
                </p>
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="th w-8">
                      <input type="checkbox" checked={todosSelecionados} onChange={() => alternarGrupo(g)} />
                    </th>
                    <th className="th">Rota</th>
                    <th className="th">Cliente</th>
                    <th className="th text-right">Valor</th>
                    <th className="th">Vence</th>
                    <th className="th">Estado</th>
                    <th className="th text-right">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {g.linhas.map((l) => (
                    <tr key={l.id} className={l.estado === "VENCIDO" ? "bg-red-50/40" : ""}>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={selecionados.has(l.id)}
                          onChange={() => alternar(l.id)}
                        />
                      </td>
                      <td className="td">
                        <Link
                          href={`/escritorio/rotas/${encodeURIComponent(l.idRota)}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {l.idRota}
                        </Link>
                      </td>
                      <td className="td">{l.cliente}</td>
                      <td className="td text-right">{fmtEuro(l.valor)}</td>
                      <td className="td">{fmtData(l.dataVencimento)}</td>
                      <td className="td">
                        <EstadoPagamentoBadge estado={l.estado} dias={l.diasRestantes} />
                      </td>
                      <td className="td text-right">
                        <PagoToggle paragemId={l.id} pago={l.pago} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
