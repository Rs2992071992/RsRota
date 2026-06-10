import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";

// DELETE /api/rotas/[idRota] — apaga uma rota inteira (todas as paragens com este
// idRota). Só escritório. Ação destrutiva e irreversível.
export async function DELETE(_req: Request, { params }: { params: { idRota: string } }) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const idRota = decodeURIComponent(params.idRota);
  const result = await prisma.paragem.deleteMany({ where: { idRota } });

  if (result.count === 0) {
    return NextResponse.json({ erro: "Rota não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, apagadas: result.count });
}
