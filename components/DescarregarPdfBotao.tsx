"use client";

import { useState } from "react";
import { descarregarBlob } from "@/lib/descarregar";

interface Props {
  /** Endpoint que devolve o PDF (GET). */
  url: string;
  /** Nome do ficheiro a descarregar, sem extensão. */
  nomeFicheiro: string;
  label?: string;
  className?: string;
}

/** Botão genérico "Descarregar PDF": faz fetch ao endpoint e descarrega o blob. */
export default function DescarregarPdfBotao({
  url,
  nomeFicheiro,
  label = "Descarregar PDF",
  className = "btn-secondary",
}: Props) {
  const [aGerar, setAGerar] = useState(false);

  async function onClick() {
    setAGerar(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        alert("Erro ao gerar o PDF.");
        return;
      }
      await descarregarBlob(await res.blob(), `${nomeFicheiro}.pdf`);
    } finally {
      setAGerar(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={aGerar}>
      {aGerar ? "A gerar…" : label}
    </button>
  );
}
