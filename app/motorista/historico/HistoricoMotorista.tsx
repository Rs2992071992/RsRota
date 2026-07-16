"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ParagemEditor, { type ParagemEditavel, type VeiculoOpcao } from "@/components/ParagemEditor";
import { fmtData, fmtNum } from "@/lib/format";

export type ParagemHist = ParagemEditavel;

interface Props {
  paragens: ParagemHist[];
  zonas: string[];
  veiculos: VeiculoOpcao[];
  valorNoite: number;
  pesoMedioPaleteA: number;
  pesoMedioPaleteB: number;
}

export default function HistoricoMotorista({
  paragens,
  zonas,
  veiculos,
  valorNoite,
  pesoMedioPaleteA,
  pesoMedioPaleteB,
}: Props) {
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

        return (
          <div key={idRota} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Rota {idRota} <span className="text-sm font-normal text-gray-400">· {ps.length} paragem(ns)</span>
              </h2>
              <Link href={continuarHref} className="btn-secondary text-sm">
                + Continuar rota
              </Link>
            </div>

            <ul className="divide-y divide-gray-100">
              {ps.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{p.cliente || "(sem cliente)"}</p>
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
          valorNoite={valorNoite}
          pesoMedioPaleteA={pesoMedioPaleteA}
          pesoMedioPaleteB={pesoMedioPaleteB}
          onClose={() => setAEditar(null)}
        />
      )}
    </div>
  );
}
