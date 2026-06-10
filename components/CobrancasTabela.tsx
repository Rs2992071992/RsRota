"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtEuro, fmtData } from "@/lib/format";
import type { EstadoPagamento } from "@/lib/calc/pagamentos";
import EstadoPagamentoBadge from "@/components/EstadoPagamentoBadge";
import PagoToggle from "@/components/PagoToggle";

export interface LinhaCobranca {
  id: number;
  idRota: string;
  cliente: string;
  valor: number;
  pago: boolean;
  estado: EstadoPagamento;
  diasRestantes: number;
  dataVencimento: string; // ISO
}

type Coluna = "idRota" | "cliente" | "valor" | "vence" | "estado";
type Dir = "asc" | "desc";

// Urgência crescente: vencido (mais atrasado) primeiro, pago por último.
const PRIORIDADE: Record<EstadoPagamento, number> = { VENCIDO: 0, A_AGUARDAR: 1, PAGO: 2 };

export default function CobrancasTabela({ linhas }: { linhas: LinhaCobranca[] }) {
  // coluna null = ordem por defeito vinda do servidor (vencidos primeiro).
  const [coluna, setColuna] = useState<Coluna | null>(null);
  const [dir, setDir] = useState<Dir>("asc");
  const [busca, setBusca] = useState("");

  function ordenarPor(c: Coluna) {
    if (coluna === c) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setColuna(c);
      setDir("asc");
    }
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? linhas.filter(
        (l) => l.cliente.toLowerCase().includes(termo) || l.idRota.toLowerCase().includes(termo),
      )
    : linhas;
  const ordenadas = coluna === null ? filtradas : [...filtradas].sort(comparar(coluna, dir));

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar cliente ou rota…"
          className="input max-w-xs"
        />
        {termo && (
          <span className="text-xs text-gray-500">
            {ordenadas.length} resultado{ordenadas.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th c="idRota" label="Rota" coluna={coluna} dir={dir} onClick={ordenarPor} />
            <Th c="cliente" label="Cliente" coluna={coluna} dir={dir} onClick={ordenarPor} />
            <Th c="valor" label="Valor" coluna={coluna} dir={dir} onClick={ordenarPor} align="right" />
            <Th c="vence" label="Vence" coluna={coluna} dir={dir} onClick={ordenarPor} />
            <Th c="estado" label="Estado" coluna={coluna} dir={dir} onClick={ordenarPor} />
            <th className="th text-right">Pago</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ordenadas.length === 0 && (
            <tr>
              <td colSpan={6} className="td text-center text-gray-500">
                Sem resultados para “{busca.trim()}”.
              </td>
            </tr>
          )}
          {ordenadas.map((l) => (
            <tr key={l.id} className={l.estado === "VENCIDO" ? "bg-red-50/40" : ""}>
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
}

/** Comparador por coluna; aplica a direção no fim. */
function comparar(coluna: Coluna, dir: Dir) {
  const sinal = dir === "asc" ? 1 : -1;
  return (a: LinhaCobranca, b: LinhaCobranca): number => {
    let r = 0;
    switch (coluna) {
      case "idRota":
        r = a.idRota.localeCompare(b.idRota, "pt");
        break;
      case "cliente":
        r = a.cliente.localeCompare(b.cliente, "pt");
        break;
      case "valor":
        r = a.valor - b.valor;
        break;
      case "vence":
        r = new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
        break;
      case "estado":
        // Por urgência: estado e, dentro do mesmo, dias restantes (mais atrasado primeiro).
        r = PRIORIDADE[a.estado] - PRIORIDADE[b.estado] || a.diasRestantes - b.diasRestantes;
        break;
    }
    return r * sinal;
  };
}

function Th({
  c,
  label,
  coluna,
  dir,
  onClick,
  align = "left",
}: {
  c: Coluna;
  label: string;
  coluna: Coluna | null;
  dir: Dir;
  onClick: (c: Coluna) => void;
  align?: "left" | "right";
}) {
  const ativo = coluna === c;
  return (
    <th className={`th ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onClick(c)}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${ativo ? "text-gray-900" : ""}`}
      >
        {label}
        <span className="text-gray-400">{ativo ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
