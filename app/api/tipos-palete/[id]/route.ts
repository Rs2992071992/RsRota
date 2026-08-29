import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { tipoPaleteUpdateSchema } from "@/lib/validacao";
import { ehErroFkRestricao } from "@/lib/prisma-errors";

// PATCH /api/tipos-palete/[id] — atualiza um tipo de palete (só escritório).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = tipoPaleteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.tipoPalete.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Tipo de palete não encontrado." }, { status: 404 });

  const tipoPalete = await prisma.tipoPalete.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true, tipoPalete });
}

// DELETE /api/tipos-palete/[id] — apaga um tipo de palete (só escritório).
// Se tiver pedidos associados, sugere desativar em vez de apagar.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.tipoPalete.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Tipo de palete não encontrado." }, { status: 404 });

  try {
    await prisma.tipoPalete.delete({ where: { id } });
  } catch (e) {
    if (ehErroFkRestricao(e)) {
      return NextResponse.json(
        { erro: "Este tipo de palete tem pedidos associados. Desative-o em vez de apagar." },
        { status: 409 },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
