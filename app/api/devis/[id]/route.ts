import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { devisSchema } from "@/lib/validacao";
import { totaisDevis } from "@/lib/calc/orcamento";

// Atualização parcial de um orçamento (linhas, preços, estado, validade, …).
const patchSchema = devisSchema.partial();

// PATCH /api/devis/[id] — edita um orçamento (só escritório). Recalcula os totais
// quando as linhas ou o IVA mudam.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const atual = await prisma.devis.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Record<string, unknown> = {};

  if (d.cliente !== undefined) data.cliente = d.cliente;
  if (d.clienteEmail !== undefined) data.clienteEmail = d.clienteEmail ?? null;
  if (d.clienteMorada !== undefined) data.clienteMorada = d.clienteMorada ?? null;
  if (d.clienteContato !== undefined) data.clienteContato = d.clienteContato ?? null;
  if (d.estado !== undefined) data.estado = d.estado;
  if (d.origemPadrao !== undefined) data.origemPadrao = d.origemPadrao ?? null;
  if (d.observacoes !== undefined) data.observacoes = d.observacoes ?? null;
  if (d.validade !== undefined) data.validade = d.validade ? new Date(d.validade) : null;
  if (d.linhas !== undefined) data.linhas = d.linhas as unknown as Prisma.InputJsonValue;
  if (d.ivaPercent !== undefined) data.ivaPercent = d.ivaPercent;

  // Recalcula os totais se as linhas ou o IVA mudaram (usa os valores efetivos).
  if (d.linhas !== undefined || d.ivaPercent !== undefined) {
    const linhas = (d.linhas ?? (atual.linhas as unknown)) as { preco: number }[];
    const iva = d.ivaPercent ?? atual.ivaPercent;
    const t = totaisDevis(linhas, iva);
    data.subtotal = t.subtotal;
    data.ivaValor = t.ivaValor;
    data.total = t.total;
  }

  const atualizado = await prisma.devis.update({ where: { id }, data });
  return NextResponse.json({ ok: true, devis: atualizado });
}

// DELETE /api/devis/[id] — apaga um orçamento (só escritório).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }
  const existe = await prisma.devis.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });

  await prisma.devis.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
