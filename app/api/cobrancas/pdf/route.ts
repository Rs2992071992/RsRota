import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSessao } from "@/lib/session";
import { carregarCobrancas } from "@/lib/cobrancas-service";
import { CobrancasDocument } from "@/lib/pdf/CobrancasDocument";

// @react-pdf precisa do runtime Node (não Edge).
export const runtime = "nodejs";

// GET /api/cobrancas/pdf — PDF da tabela "Contas a receber" inteira (só escritório).
export async function GET() {
  if (getSessao() !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }

  const linhas = await carregarCobrancas();

  const elemento = React.createElement(CobrancasDocument, {
    linhas,
    geradoEm: new Date(),
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contas-a-receber.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
