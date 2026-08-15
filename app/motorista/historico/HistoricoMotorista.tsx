"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ParagemEditor, { type ParagemEditavel, type VeiculoOpcao } from "@/components/ParagemEditor";
import DespesasIcones from "@/components/DespesasIcones";
import { fmtData, fmtEuro, fmtNum } from "@/lib/format";

export type ParagemHist = ParagemEditavel;

interface Props {
  paragens: ParagemHist[];
  zonas: string[];
  veiculos: VeiculoOpcao[];
  clientes: string[];
  valorNoite: number;
}

export default function HistoricoMotorista({ paragens, zonas, veiculos, clientes, valorNoite }: Props) {
  const [aEditar, setAEditar] = useState<ParagemHist | null>(null);

  // Agrupa por ID Rota, mantendo a ordem (mais recente primeiro).
  const rotas = useMemo(() => {
    const mapa = new Map<string, ParagemHist[]>();
    for (const p of paragens) {
      const arr = mapa.get(p.idRota) ?? [];
      arr.push(p);
      mapa.set(p.idRota, arr);
    }
    return Array.from(mapa.entries());
  }, [paragens]);

  if (paragens.length === 0) {
    return (
      <div className="card text-center text-sm text-gray-500">
        Ainda não registou nenhuma paragem.{" "}
        <Link href="/motorista/registo" className="text-brand hover:underline">
          Registar a primeira →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">As minhas rotas</h1>

      {rotas.map(([idRota, ps]) => {
        // A última paragem (a mais recente) serve de base ao "continuar rota".
        const ultima = ps[0];
        const continuarHref =
          `/motorista/registo?idRota=${encodeURIComponent(idRota)}` +
          `&tipoVeiculo=${encodeURIComponent(ultima.tipoVeiculo)}` +
          `&kmInicial=${ultima.kmFinal}`;
        const totalNoites = ps.reduce((soma, p) => soma + p.noitesFora, 0);
        const totalAlimentacao = ps.reduce((soma, p) => soma + p.alimentacao, 0);
        const totalZonasPortagem = ps.filter((p) => p.zonaPortagem.trim() !== "").length;

        return (
          <div key={idRota} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Rota {idRota}{" "}
                <span className="text-sm font-normal text-gray-400">
                  · {ps.length} paragem(ns)
                  {totalZonasPortagem > 0 ? ` · ${totalZonasPortagem} zona(s) de portagem` : ""}
                  {totalNoites > 0 ? ` · ${totalNoites} noite(s)` : ""}
                  {totalAlimentacao > 0 ? ` · ${fmtEuro(totalAlimentacao)} alimentação` : ""}
                </span>
              </h2>
              <Link href={continuarHref} className="btn-secondary text-sm">
                + Continuar rota
              </Link>
            </div>

            <ul className="divide-y divide-gray-100">
              {ps.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.cliente || "(sem cliente)"}
                      <DespesasIcones raw={p} />
                    </p>
                    <p className="text-xs text-gray-500">
                      {fmtData(p.data)} · {p.tipoVeiculo} · {fmtNum(p.kmFinal - p.kmInicial)} km
                      {p.kgCarregados > 0 ? ` · ${fmtNum(p.kgCarregados)} kg` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setAEditar(p)}
                    className="rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand/5"
                  >
                    Corrigir
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {aEditar && (
        <ParagemEditor
          paragem={aEditar}
          zonas={zonas}
          veiculos={veiculos}
          clientes={clientes}
          valorNoite={valorNoite}
          mostrarDetalheEuroNoites={false}
          mostrarFaturarCliente={false}
          onClose={() => setAEditar(null)}
        />
      )}
    </div>
  );
}
