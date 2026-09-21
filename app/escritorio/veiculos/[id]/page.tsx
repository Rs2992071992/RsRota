import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { carregarEstatisticasVeiculo } from "@/lib/veiculos-service";
import { veiculoParaForm, custoVeiculoKm, REF_KM_ANUAIS } from "@/lib/veiculo-form";
import { fmtNum, fmtNum2 } from "@/lib/format";
import { VeiculoGraficoKg, VeiculoGraficoPaletes } from "@/components/VeiculoGrafico";
import VeiculoDetalheEditor from "./VeiculoDetalheEditor";

export const dynamic = "force-dynamic";

export default async function VeiculoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const [veiculo, stats, reboques] = await Promise.all([
    prisma.veiculo.findUnique({
      where: { id },
      include: {
        pneus: { orderBy: { ordem: "asc" } },
        consumoTabela: { orderBy: { cargaKg: "asc" } },
        manutencoes: { orderBy: { data: "desc" } },
      },
    }),
    carregarEstatisticasVeiculo(id),
    prisma.reboque.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!veiculo) notFound();

  // veiculoParaForm espera `consumo` (nome do campo no formulário) — o Prisma
  // devolve a relação como `consumoTabela`.
  const veiculoForm = veiculoParaForm({ ...veiculo, categoria: veiculo.categoria as "LIGEIRO" | "PESADO", consumo: veiculo.consumoTabela });
  const custoKm = custoVeiculoKm(veiculoForm);

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi rotulo="Cargas efetuadas" valor={fmtNum(stats.cargasEfetuadas)} />
        <Kpi rotulo="Clientes atendidos" valor={fmtNum(stats.clientesAtendidos)} />
        <Kpi rotulo="Kg transportados (este ano)" valor={`${fmtNum(stats.kgAnoAtual)} kg`} />
        <Kpi rotulo="Paletes transportadas (este ano)" valor={fmtNum(stats.paletesAnoAtual)} />
        <Kpi
          rotulo="Custo veículo / km"
          valor={`${fmtNum2(custoKm)} €`}
          nota={`ref. ${REF_KM_ANUAIS.toLocaleString("pt-PT")} km/ano`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Kg transportados por mês (ano corrente)</h3>
          <VeiculoGraficoKg serie={stats.serieMensalAnoAtual} />
        </div>
        <div className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Paletes transportadas por mês (ano corrente)</h3>
          <VeiculoGraficoPaletes serie={stats.serieMensalPaletesAnoAtual} />
        </div>
      </div>

      <VeiculoDetalheEditor
        veiculoId={veiculo.id}
        inicial={veiculoForm}
        veiculoNome={veiculo.nome}
        manutencoesIniciais={veiculo.manutencoes.map((m) => ({
          id: m.id,
          descricao: m.descricao,
          km: m.km,
          data: m.data.toISOString(),
          valor: m.valor,
          dias: m.dias,
        }))}
        reboques={reboques}
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
