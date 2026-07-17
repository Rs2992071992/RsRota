import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtData } from "@/lib/format";
import OrcamentoForm, { type DevisFull } from "@/components/orcamento/OrcamentoForm";
import EstadoOrcamentoBadge from "@/components/orcamento/EstadoOrcamentoBadge";
import EnviarOrcamento from "@/components/orcamento/EnviarOrcamento";
import type { LinhaDevis } from "@/lib/calc/orcamento";

export const dynamic = "force-dynamic";

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const [devis, clientes, veiculos, motoristas] = await Promise.all([
    prisma.devis.findUnique({ where: { id } }),
    prisma.cliente.findMany({
      orderBy: { nome: "asc" },
      select: { nome: true, email: true, morada: true, contato: true },
    }),
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
  ]);

  if (!devis) notFound();

  const dados: DevisFull = {
    id: devis.id,
    numero: devis.numero,
    cliente: devis.cliente,
    clienteEmail: devis.clienteEmail,
    clienteMorada: devis.clienteMorada,
    clienteContato: devis.clienteContato,
    validade: devis.validade ? devis.validade.toISOString().slice(0, 10) : "",
    estado: devis.estado,
    origemPadrao: devis.origemPadrao,
    observacoes: devis.observacoes,
    ivaPercent: devis.ivaPercent,
    linhas: (devis.linhas as unknown as LinhaDevis[]) ?? [],
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/escritorio/orcamentos" className="text-sm text-brand hover:underline">
            ← Orçamentos
          </Link>
          <h1 className="text-2xl font-bold">{devis.numero}</h1>
          <EstadoOrcamentoBadge estado={devis.estado} />
        </div>
        <EnviarOrcamento
          id={devis.id}
          numero={devis.numero}
          clienteEmail={devis.clienteEmail}
          estado={devis.estado}
        />
      </div>
      <p className="text-sm text-gray-500">
        Criado em {fmtData(devis.data)}
        {devis.validade ? ` · válido até ${fmtData(devis.validade)}` : ""}
      </p>

      <OrcamentoForm
        devis={dados}
        clientes={clientes}
        veiculos={veiculos}
        motoristas={motoristas}
      />
    </div>
  );
}
