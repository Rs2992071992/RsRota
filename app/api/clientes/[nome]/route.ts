import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";

// DELETE /api/clientes/[nome] — apaga a ficha de contacto de um cliente (só
// escritório). Só permitido quando o nome não tem NENHUM histórico real
// (paragens, orçamentos ou pedidos de paletes) — nesses casos apagar a ficha
// nem sequer faria o nome desaparecer da lista (que é derivada também de
// Paragem.cliente), e apagar as paragens seria destrutivo. Para um nome com
// histórico (ex.: variante criada pelo motorista por engano, já corrigida
// nalgumas paragens mas não todas), o caminho certo é "Editar nome" (funde
// tudo no nome certo, ver /api/clientes/agrupar) — nunca apagar.
export async function DELETE(_req: Request, props: { params: Promise<{ nome: string }> }) {
  if ((await getSessao()) !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const params = await props.params;
  const nome = decodeURIComponent(params.nome);

  const [nParagens, nDevis, nPedidos] = await Promise.all([
    prisma.paragem.count({ where: { cliente: nome } }),
    prisma.devis.count({ where: { cliente: nome } }),
    prisma.pedidoPalete.count({ where: { cliente: { nome } } }),
  ]);

  if (nParagens > 0 || nDevis > 0 || nPedidos > 0) {
    const partes = [
      nParagens > 0 ? `${nParagens} paragem(ns)` : null,
      nDevis > 0 ? `${nDevis} orçamento(s)` : null,
      nPedidos > 0 ? `${nPedidos} pedido(s) de paletes` : null,
    ].filter(Boolean);
    return NextResponse.json(
      {
        erro: `Este nome tem histórico real (${partes.join(", ")}) — apagar não o faria desaparecer da lista. Usa "Editar nome" para o fundir no cliente certo.`,
      },
      { status: 409 },
    );
  }

  const apagado = await prisma.cliente.deleteMany({ where: { nome } });
  if (apagado.count === 0) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
