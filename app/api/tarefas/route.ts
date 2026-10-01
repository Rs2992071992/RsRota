import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { tarefaSchema } from "@/lib/validacao";

// GET /api/tarefas — motorista: as suas tarefas; escritório: filtra por
// ?motoristaId=. Ordenadas por data prevista (pendentes primeiro).
export async function GET(req: Request) {
  const sessao = await getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let motoristaId: number | undefined;
  if (sessao.perfil === "MOTORISTA") {
    motoristaId = sessao.id;
  } else {
    const param = new URL(req.url).searchParams.get("motoristaId");
    if (param !== null) {
      motoristaId = Number(param);
      if (!Number.isInteger(motoristaId)) {
        return NextResponse.json({ erro: "motoristaId inválido." }, { status: 400 });
      }
    }
  }

  const tarefas = await prisma.tarefa.findMany({
    where: motoristaId === undefined ? {} : { motoristaId },
    orderBy: [{ concluida: "asc" }, { dataPrevista: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ tarefas });
}

// POST /api/tarefas — cria uma tarefa para um motorista (só escritório).
export async function POST(req: Request) {
  const sessao = await getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (sessao.perfil !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = tarefaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { motoristaId, dataPrevista, titulo, descricao } = parsed.data;
  const motorista = await prisma.utilizador.findUnique({ where: { id: motoristaId } });
  if (!motorista || motorista.perfil !== "MOTORISTA") {
    return NextResponse.json({ erro: "Motorista não encontrado." }, { status: 404 });
  }

  const tarefa = await prisma.tarefa.create({
    data: { motoristaId, dataPrevista: new Date(dataPrevista), titulo, descricao: descricao || null },
  });
  return NextResponse.json({ ok: true, tarefa }, { status: 201 });
}
