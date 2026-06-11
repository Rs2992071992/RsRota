import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { devisSchema } from "@/lib/validacao";
import { proximoNumeroDevis, totaisDevis } from "@/lib/calc/orcamento";

// POST /api/devis — cria um orçamento (só escritório). Gera o número, congela os
// dados de contacto do cliente e calcula os totais a partir das linhas.
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = devisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Número sequencial do ano (ORC-AAAA-NNNN).
  const ano = new Date().getFullYear();
  const existentes = await prisma.devis.findMany({
    where: { numero: { startsWith: `ORC-${ano}-` } },
    select: { numero: true },
  });
  const numero = proximoNumeroDevis(ano, existentes.map((e) => e.numero));

  // Validade por defeito: hoje + 30 dias.
  const validade = d.validade
    ? new Date(d.validade)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { subtotal, ivaValor, total } = totaisDevis(d.linhas, d.ivaPercent);

  const criado = await prisma.devis.create({
    data: {
      numero,
      cliente: d.cliente,
      clienteEmail: d.clienteEmail ?? null,
      clienteMorada: d.clienteMorada ?? null,
      clienteContato: d.clienteContato ?? null,
      validade,
      estado: d.estado,
      origemPadrao: d.origemPadrao ?? null,
      linhas: d.linhas as unknown as Prisma.InputJsonValue,
      observacoes: d.observacoes ?? null,
      ivaPercent: d.ivaPercent,
      subtotal,
      ivaValor,
      total,
    },
  });

  return NextResponse.json({ ok: true, devis: criado }, { status: 201 });
}

// GET /api/devis — lista (só escritório).
export async function GET() {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const devis = await prisma.devis.findMany({ orderBy: { criadoEm: "desc" } });
  return NextResponse.json({ devis });
}
