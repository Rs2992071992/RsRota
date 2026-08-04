import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { carregarCarregamento } from "@/lib/carregamento-service";
import { listarNomesClientes } from "@/lib/clientes-service";
import CarregamentoDetalheEditor from "./CarregamentoDetalheEditor";

export const dynamic = "force-dynamic";

export default async function CarregamentoDetalhePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const [detalhe, clientes, nomesClientes, reboquesAtivos, tiposPaleteAtivos] = await Promise.all([
    carregarCarregamento(id),
    prisma.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    listarNomesClientes(),
    prisma.reboque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.tipoPalete.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    }),
  ]);
  if (!detalhe) notFound();

  return (
    <div className="space-y-5">
      <Link href="/escritorio/cargas" className="text-sm text-gray-500 hover:underline">
        ← Cargas
      </Link>

      <CarregamentoDetalheEditor
        detalheInicial={{ ...detalhe, data: detalhe.data.toISOString() }}
        clientes={clientes}
        nomesClientesConhecidos={nomesClientes.map((n) => n.nome)}
        reboquesAtivos={reboquesAtivos}
        tiposPaleteAtivos={tiposPaleteAtivos}
      />
    </div>
  );
}
