import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { DevisDocument, type DevisPdfData } from "@/lib/pdf/DevisDocument";
import type { LinhaDevis } from "@/lib/calc/orcamento";

// @react-pdf precisa do runtime Node (não Edge).
export const runtime = "nodejs";

// GET /api/devis/[id]/pdf — gera o PDF do orçamento (só escritório).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new Response("ID inválido.", { status: 400 });

  const devis = await prisma.devis.findUnique({ where: { id } });
  if (!devis) return new Response("Não encontrado.", { status: 404 });

  const data: DevisPdfData = {
    numero: devis.numero,
    cliente: devis.cliente,
    clienteEmail: devis.clienteEmail,
    clienteMorada: devis.clienteMorada,
    clienteContato: devis.clienteContato,
    data: devis.data,
    validade: devis.validade,
    linhas: (devis.linhas as unknown as LinhaDevis[]) ?? [],
    observacoes: devis.observacoes,
    ivaPercent: devis.ivaPercent,
    subtotal: devis.subtotal,
    ivaValor: devis.ivaValor,
    total: devis.total,
  };

  // O elemento embrulha um <Document>; o cast satisfaz a assinatura do renderToBuffer.
  const elemento = React.createElement(DevisDocument, {
    devis: data,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${devis.numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
