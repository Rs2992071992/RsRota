"use client";

import { useState } from "react";
import ParagemEditor, { type ParagemEditavel, type VeiculoOpcao } from "@/components/ParagemEditor";

interface Props {
  paragem: ParagemEditavel;
  zonas: string[];
  veiculos: VeiculoOpcao[];
  valorNoite: number;
}

/** Botão "Editar" (escritório) que abre o editor completo da paragem. */
export default function ParagemAcoes({ paragem, zonas, veiculos, valorNoite }: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand/5"
      >
        Editar
      </button>
      {aberto && (
        <ParagemEditor
          paragem={paragem}
          zonas={zonas}
          veiculos={veiculos}
          valorNoite={valorNoite}
          mostrarReceita
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
