import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { clienteContactoSchema } from "@/lib/validacao";

// PATCH /api/clientes — cria/atualiza a ficha de contacto de um cliente (só escritório).
// Upsert por `nome` (= Paragem.cliente). Campos vazios são normalizados para null.
export async function PATCH(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = clienteContactoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { nome, ...dados } = parsed.data;
  const norm = Object.fromEntries(
    Object.entries(dados).map(([k, v]) => [k, v && v.trim() ? v.trim() : null]),
  );

  const cliente = await prisma.cliente.upsert({
    where: { nome },
    update: norm,
    create: { nome, ...norm },
  });
  return NextResponse.json({ ok: true, cliente });
}
