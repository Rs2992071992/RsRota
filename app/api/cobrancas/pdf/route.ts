import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSessao } from "@/lib/session";
import { carregarCobrancas, carregarCobrancasPorIds } from "@/lib/cobrancas-service";
import { CobrancasDocument } from "@/lib/pdf/CobrancasDocument";
import { selecaoCobrancaSchema } from "@/lib/validacao";

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

// POST /api/cobrancas/pdf — PDF de uma seleção manual de linhas (checkboxes
// na tabela de Cobranças), ex.: só os clientes de uma empresa (só escritório).
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = selecaoCobrancaSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Dados inválidos.", { status: 400 });
  }

  const linhas = await carregarCobrancasPorIds(parsed.data.ids);
  if (linhas.length === 0) {
    return new Response("Nenhuma linha encontrada.", { status: 404 });
  }

  const titulo = parsed.data.titulo || "SITUAÇÃO DE CONTA";
  const elemento = React.createElement(CobrancasDocument, {
    linhas,
    geradoEm: new Date(),
    titulo,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  const nomeSeguro = titulo.replace(/["\r\n]/g, "").replace(/[^\x20-\x7E]/g, "_");
  const nomeCodificado = encodeURIComponent(`${titulo}.pdf`);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${nomeSeguro}.pdf"; filename*=UTF-8''${nomeCodificado}`,
      "Cache-Control": "no-store",
    },
  });
}
