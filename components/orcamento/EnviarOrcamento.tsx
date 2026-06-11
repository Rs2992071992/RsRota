"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: number;
  numero: string;
  clienteEmail: string | null;
  estado: string;
}

/**
 * Ações de saída de um orçamento (envio "sem servidor"):
 * - Descarregar PDF: gera e descarrega o ficheiro.
 * - Preparar email: descarrega o PDF e abre o cliente de email pré-preenchido
 *   (mailto não pode anexar ficheiros automaticamente → o utilizador arrasta o PDF).
 */
export default function EnviarOrcamento({ id, numero, clienteEmail, estado }: Props) {
  const router = useRouter();
  const [aGerar, setAGerar] = useState(false);
  const [dica, setDica] = useState(false);

  async function descarregarPdf(): Promise<boolean> {
    const res = await fetch(`/api/devis/${id}/pdf`);
    if (!res.ok) {
      alert("Erro ao gerar o PDF.");
      return false;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${numero}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  async function onDescarregar() {
    setAGerar(true);
    try {
      await descarregarPdf();
    } finally {
      setAGerar(false);
    }
  }

  async function onPrepararEmail() {
    setAGerar(true);
    try {
      const ok = await descarregarPdf();
      if (!ok) return;

      const assunto = `Orçamento ${numero}`;
      const corpo =
        `Bom dia,\n\n` +
        `Segue o nosso orçamento ${numero} para o transporte solicitado.\n` +
        `O PDF foi descarregado para o seu computador — anexe-o a este email antes de enviar.\n\n` +
        `Ficamos ao dispor para qualquer esclarecimento.\n\n` +
        `Com os melhores cumprimentos,`;
      const dest = clienteEmail ?? "";
      window.location.href =
        `mailto:${dest}?subject=${encodeURIComponent(assunto)}` +
        `&body=${encodeURIComponent(corpo)}`;
      setDica(true);

      if (estado !== "ENVIADO" && estado !== "ACEITE") {
        if (confirm("Marcar este orçamento como “Enviado”?")) {
          await fetch(`/api/devis/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: "ENVIADO" }),
          });
          router.refresh();
        }
      }
    } finally {
      setAGerar(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={onDescarregar} disabled={aGerar}>
          Descarregar PDF
        </button>
        <button className="btn" onClick={onPrepararEmail} disabled={aGerar}>
          {aGerar ? "A preparar…" : "Preparar email"}
        </button>
      </div>
      {!clienteEmail && (
        <p className="text-xs text-amber-600">
          Sem email do cliente — preencha-o no orçamento para pré-endereçar.
        </p>
      )}
      {dica && (
        <p className="max-w-xs text-right text-xs text-gray-500">
          PDF descarregado. Arraste-o para o email que acabou de abrir e envie.
        </p>
      )}
    </div>
  );
}
