import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { avariaItemUpdateSchema } from "@/lib/validacao";

interface ItemAvaria {
  id: number;
  texto: string;
  resolvido: boolean;
}

// PATCH /api/avarias/[id]/itens/[itemId] — marca um item da checklist como
// resolvido/pendente. Qualquer sessão autenticada (motorista OU escritório
// — os dois confirmam à medida que vão resolvendo). `resolvida`/`resolvidaEm`
// da avaria são sempre derivados de todos os itens, nunca editados à parte.
export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const sessao = getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const id = Number(params.id);
  const itemId = Number(params.itemId);
  if (!Number.isInteger(id) || !Number.isInteger(itemId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = avariaItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const avaria = await prisma.avaria.findUnique({ where: { id } });
  if (!avaria) return NextResponse.json({ erro: "Pedido de manutenção não encontrado." }, { status: 404 });

  const itens = avaria.itens as unknown as ItemAvaria[];
  const existe = itens.some((i) => i.id === itemId);
  if (!existe) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });

  const novosItens = itens.map((i) => (i.id === itemId ? { ...i, resolvido: parsed.data.resolvido } : i));
  const resolvida = novosItens.every((i) => i.resolvido);

  const atualizada = await prisma.avaria.update({
    where: { id },
    data: {
      itens: novosItens as unknown as Prisma.InputJsonValue,
      resolvida,
      resolvidaEm: resolvida ? new Date() : null,
    },
  });
  return NextResponse.json({ ok: true, avaria: atualizada });
}
