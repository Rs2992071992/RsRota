import Link from "next/link";
import { prisma } from "@/lib/db";
import AvariasTabela from "@/components/AvariasTabela";

export const dynamic = "force-dynamic";

export default async function AvariasPage() {
  const avarias = await prisma.avaria.findMany({
    include: {
      veiculo: { select: { nome: true, matricula: true } },
      reportadoPor: { select: { nome: true, codigo: true } },
    },
    orderBy: [{ resolvida: "asc" }, { data: "desc" }],
  });

  const linhas = avarias.map((a) => ({
    id: a.id,
    veiculo: a.veiculo.nome + (a.veiculo.matricula ? ` (${a.veiculo.matricula})` : ""),
    data: a.data.toISOString(),
    descricao: a.descricao,
    reportadoPor: a.reportadoPor?.nome || a.reportadoPor?.codigo || null,
    resolvida: a.resolvida,
  }));

  return (
    <div className="space-y-5">
      <Link href="/escritorio/veiculos" className="text-sm text-gray-500 hover:underline">
        ← Veículos
      </Link>

      <h1 className="text-2xl font-bold">Pedidos de Manutenção</h1>

      <div className="card scroll-fade-x overflow-x-auto">
        {linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Sem pedidos de manutenção reportados.</p>
        ) : (
          <AvariasTabela linhas={linhas} />
        )}
      </div>
    </div>
  );
}
