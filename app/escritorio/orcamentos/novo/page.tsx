import Link from "next/link";
import { prisma } from "@/lib/db";
import { listarClientesParaOrcamento } from "@/lib/clientes-service";
import OrcamentoForm from "@/components/orcamento/OrcamentoForm";

export const dynamic = "force-dynamic";

export default async function NovoOrcamentoPage(
  props: {
    searchParams: Promise<{ cliente?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const [clientes, veiculos, motoristas, portagens, tiposPalete] = await Promise.all([
    listarClientesParaOrcamento(),
    prisma.veiculo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.utilizador.findMany({
      where: { perfil: "MOTORISTA" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, codigo: true },
    }),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" }, select: { zona: true } }),
    prisma.tipoPalete.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/escritorio/orcamentos" className="text-sm text-brand hover:underline">
          ← Orçamentos
        </Link>
        <h1 className="text-2xl font-bold">Novo orçamento</h1>
      </div>
      <OrcamentoForm
        clientes={clientes}
        veiculos={veiculos}
        tiposPalete={tiposPalete}
        motoristas={motoristas}
        zonas={portagens.map((p) => p.zona)}
        clienteInicial={searchParams.cliente}
      />
    </div>
  );
}
