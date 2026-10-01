import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import TarefasLista from "./TarefasLista";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const sessao = await getSessaoInfo();
  const tarefas = sessao
    ? await prisma.tarefa.findMany({
        where: { motoristaId: sessao.id },
        orderBy: [{ dataPrevista: "asc" }, { id: "asc" }],
        take: 100,
      })
    : [];

  return (
    <TarefasLista
      inicial={tarefas.map((t) => ({
        id: t.id,
        dataPrevista: t.dataPrevista.toISOString(),
        titulo: t.titulo,
        descricao: t.descricao,
        concluida: t.concluida,
      }))}
    />
  );
}
