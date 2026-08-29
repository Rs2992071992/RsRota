import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { rotaOverrideSchema } from "@/lib/validacao";

// DELETE /api/rotas/[idRota] — apaga uma rota inteira (todas as paragens com este
// idRota). Só escritório. Ação destrutiva e irreversível.
export async function DELETE(_req: Request, props: { params: Promise<{ idRota: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const idRota = decodeURIComponent(params.idRota);
  const result = await prisma.paragem.deleteMany({ where: { idRota } });

  if (result.count === 0) {
    return NextResponse.json({ erro: "Rota não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, apagadas: result.count });
}

// PATCH /api/rotas/[idRota] — aplica o override de preço de ref. combustível a
// TODAS as paragens da rota de uma vez. Só escritório. Valor null/omitido volta
// a usar o preço global de Parâmetros (ver Paragem.precoCombRefOverride).
export async function PATCH(req: Request, props: { params: Promise<{ idRota: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = rotaOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const idRota = decodeURIComponent(params.idRota);
  const result = await prisma.paragem.updateMany({
    where: { idRota },
    data: { precoCombRefOverride: parsed.data.precoCombRefOverride ?? null },
  });

  if (result.count === 0) {
    return NextResponse.json({ erro: "Rota não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, atualizadas: result.count });
}
