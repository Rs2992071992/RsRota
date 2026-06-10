import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { paragemSchema } from "@/lib/validacao";

// Atualização parcial — usada para editar a receita (escritório) ou corrigir uma
// paragem (escritório, ou o próprio motorista nas suas paragens).
const patchSchema = paragemSchema.innerType().partial();

/**
 * Verifica permissão sobre uma paragem: escritório pode tudo; um motorista só
 * pode mexer nas paragens que ele próprio registou. Devolve a paragem ou null.
 */
async function paragemAutorizada(id: number) {
  const sessao = getSessaoInfo();
  if (!sessao) return { erro: 401 as const, paragem: null };
  const paragem = await prisma.paragem.findUnique({ where: { id } });
  if (!paragem) return { erro: 404 as const, paragem: null };
  if (sessao.perfil === "ESCRITORIO") return { erro: null, paragem };
  if (sessao.perfil === "MOTORISTA" && paragem.motoristaId === sessao.id) {
    return { erro: null, paragem };
  }
  return { erro: 403 as const, paragem: null };
}

// PATCH /api/paragens/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const auth = await paragemAutorizada(id);
  if (auth.erro) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: auth.erro });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.data) data.data = new Date(d.data);

  const atualizada = await prisma.paragem.update({ where: { id }, data });
  return NextResponse.json({ ok: true, paragem: atualizada });
}

// DELETE /api/paragens/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const auth = await paragemAutorizada(id);
  if (auth.erro) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: auth.erro });
  }

  await prisma.paragem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
