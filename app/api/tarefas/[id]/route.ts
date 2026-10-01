import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { tarefaUpdateSchema } from "@/lib/validacao";

// PATCH /api/tarefas/[id] — escritório edita tudo; o motorista só pode
// marcar/desmarcar como concluída as SUAS tarefas.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const sessao = await getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = tarefaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existe = await prisma.tarefa.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });

  const { dataPrevista, titulo, descricao, concluida } = parsed.data;
  if (sessao.perfil === "MOTORISTA") {
    if (existe.motoristaId !== sessao.id) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }
    if (concluida === undefined || dataPrevista !== undefined || titulo !== undefined || descricao !== undefined) {
      return NextResponse.json({ erro: "Só pode marcar a tarefa como feita." }, { status: 403 });
    }
  }

  const tarefa = await prisma.tarefa.update({
    where: { id },
    data: {
      ...(dataPrevista !== undefined && { dataPrevista: new Date(dataPrevista) }),
      ...(titulo !== undefined && { titulo }),
      ...(descricao !== undefined && { descricao: descricao || null }),
      ...(concluida !== undefined && { concluida, concluidaEm: concluida ? new Date() : null }),
    },
  });
  return NextResponse.json({ ok: true, tarefa });
}

// DELETE /api/tarefas/[id] — só escritório.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const sessao = await getSessaoInfo();
  if (!sessao || sessao.perfil !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

  const existe = await prisma.tarefa.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });

  await prisma.tarefa.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
