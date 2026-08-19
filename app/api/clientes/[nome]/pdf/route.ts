import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSessao } from "@/lib/session";
import { carregarCobrancas } from "@/lib/cobrancas-service";
import { ExtratoClienteDocument, type ExtratoClienteData } from "@/lib/pdf/ExtratoClienteDocument";

// @react-pdf precisa do runtime Node (não Edge).
export const runtime = "nodejs";

// GET /api/clientes/[nome]/pdf — extrato de conta de um cliente (só escritório).
export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }
  const nome = decodeURIComponent(params.nome);
  if (!nome) return new Response("Cliente inválido.", { status: 400 });

  const todas = await carregarCobrancas();
  const linhas = todas.filter((l) => l.cliente === nome && !l.pago);

  const dados: ExtratoClienteData = { cliente: nome, geradoEm: new Date(), linhas };

  const elemento = React.createElement(ExtratoClienteDocument, {
    dados,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  // Nome do cliente é texto livre (pode ter acentos/aspas) — sanitiza para o
  // fallback ASCII do Content-Disposition e usa filename* (RFC 5987) para o nome real.
  const nomeSeguro = nome.replace(/["\r\n]/g, "").replace(/[^\x20-\x7E]/g, "_");
  const nomeCodificado = encodeURIComponent(`extrato-${nome}.pdf`);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="extrato-${nomeSeguro}.pdf"; filename*=UTF-8''${nomeCodificado}`,
      "Cache-Control": "no-store",
    },
  });
}
