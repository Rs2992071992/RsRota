import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSessao } from "@/lib/session";
import { carregarCarregamento } from "@/lib/carregamento-service";
import { PlantaCargaDocument } from "@/lib/pdf/PlantaCargaDocument";

// @react-pdf precisa do runtime Node (não Edge).
export const runtime = "nodejs";

// GET /api/carregamentos/[id]/planta-pdf — planta de carga em PDF, para dar ao
// motorista e a quem carrega o camião (só escritório — módulo Cargas inteiro é).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new Response("ID inválido.", { status: 400 });

  const detalhe = await carregarCarregamento(id);
  if (!detalhe) return new Response("Carregamento não encontrado.", { status: 404 });

  const elemento = React.createElement(PlantaCargaDocument, {
    detalhe,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  const dataStr = new Date(detalhe.data).toISOString().slice(0, 10);
  const nome = `planta-carga-${detalhe.veiculo.nome}-${dataStr}`;
  const nomeSeguro = nome.replace(/["\r\n]/g, "").replace(/[^\x20-\x7E]/g, "_");
  const nomeCodificado = encodeURIComponent(`${nome}.pdf`);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeSeguro}.pdf"; filename*=UTF-8''${nomeCodificado}`,
      "Cache-Control": "no-store",
    },
  });
}
