import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { carregarEstatisticasVeiculo } from "@/lib/veiculos-service";
import { veiculoParaForm, custoVeiculoKm, REF_KM_ANUAIS } from "@/lib/veiculo-form";
import { fmtNum, fmtNum2 } from "@/lib/format";
import VeiculoGrafico from "@/components/VeiculoGrafico";
import VeiculoDetalheEditor from "./VeiculoDetalheEditor";

export const dynamic = "force-dynamic";

export default async function VeiculoDetalhePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const [veiculo, stats] = await Promise.all([
    prisma.veiculo.findUnique({
      where: { id },
      include: {
        pneus: { orderBy: { ordem: "asc" } },
        manutencoes: { orderBy: { data: "desc" } },
      },
    }),
    carregarEstatisticasVeiculo(id),
  ]);
  if (!veiculo) notFound();

  const custoKm = custoVeiculoKm(veiculoParaForm(veiculo));

  return (
    <div className="space-y-5">
      <Link href="/escritorio/veiculos" className="text-sm text-gray-500 hover:underline">
        ← Veículos
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{veiculo.nome}</h1>
          <p className="text-sm text-gray-500">{veiculo.matricula || "sem matrícula"}</p>
        </div>
        {!veiculo.ativo && <span className="text-sm text-gray-400">inativo</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Cargas efetuadas" valor={fmtNum(stats.cargasEfetuadas)} />
        <Kpi rotulo="Clientes atendidos" valor={fmtNum(stats.clientesAtendidos)} />
        <Kpi rotulo="Kg transportados (este ano)" valor={`${fmtNum(stats.kgAnoAtual)} kg`} />
        <Kpi
          rotulo="Custo veículo / km"
          valor={`${fmtNum2(custoKm)} €`}
          nota={`ref. ${REF_KM_ANUAIS.toLocaleString("pt-PT")} km/ano`}
        />
      </div>

      <div className="card">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Kg transportados por mês (ano corrente)</h3>
        <VeiculoGrafico serie={stats.serieMensalAnoAtual} />
      </div>

      <VeiculoDetalheEditor
        veiculoId={veiculo.id}
        inicial={veiculoParaForm(veiculo)}
        veiculoNome={veiculo.nome}
        manutencoesIniciais={veiculo.manutencoes.map((m) => ({
          id: m.id,
          descricao: m.descricao,
          data: m.data.toISOString(),
          valor: m.valor,
          dias: m.dias,
        }))}
      />
    </div>
  );
}

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="text-lg font-bold">{valor}</p>
      {nota && <p className="text-xs text-gray-400">{nota}</p>}
    </div>
  );
}
