import { prisma } from "@/lib/db";
import CargasManager from "./CargasManager";

export const dynamic = "force-dynamic";

export default async function CargasPage() {
  const [carregamentos, veiculos] = await Promise.all([
    prisma.carregamento.findMany({
      orderBy: [{ estado: "asc" }, { data: "desc" }],
      include: {
        veiculo: { select: { nome: true, matricula: true } },
        reboque: { select: { nome: true } },
        _count: { select: { pedidos: true } },
      },
    }),
    prisma.veiculo.findMany({
      where: { ativo: true, categoria: "PESADO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true, caixaComprimentoMm: true, caixaLarguraMm: true },
    }),
  ]);

  const lista = carregamentos.map((c) => ({
    id: c.id,
    data: c.data.toISOString(),
    estado: c.estado,
    veiculoNome: c.veiculo.nome,
    veiculoMatricula: c.veiculo.matricula,
    reboqueNome: c.reboque?.nome ?? null,
    nPedidos: c._count.pedidos,
  }));

  return <CargasManager carregamentos={lista} veiculos={veiculos} />;
}
