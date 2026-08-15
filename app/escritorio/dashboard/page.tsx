import Link from "next/link";
import { carregarDashboard } from "@/lib/dashboard-service";
import { fmtEuro, fmtNum } from "@/lib/format";
import {
  GraficoCustoReceita,
  GraficoEstrutura,
  GraficoEvolucao,
  GraficoRanking,
} from "./Charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await carregarDashboard();

  if (d.kpis.nRotas === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="card text-gray-500">
          Ainda não há rotas registadas. Comece por{" "}
          <Link href="/escritorio/importar" className="text-brand underline">
            importar o Excel
          </Link>{" "}
          ou registar paragens.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Dashboard de Rentabilidade</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Kpi titulo="Rotas" valor={fmtNum(d.kpis.nRotas)} />
        <Kpi titulo="KM totais" valor={fmtNum(d.kpis.kmTotais)} />
        <Kpi titulo="Custo total" valor={fmtEuro(d.kpis.custoTotal)} />
        <Kpi titulo="Receita total" valor={fmtEuro(d.kpis.receitaTotal)} />
        <Kpi
          titulo="Lucro total"
          valor={fmtEuro(d.kpis.lucroTotal)}
          cor={d.kpis.lucroTotal < 0 ? "text-red-600" : "text-green-600"}
        />
        <Kpi titulo="Margem média" valor={`${d.kpis.margemMedia.toFixed(1)} %`} />
        <Kpi
          titulo="Rotas em prejuízo"
          valor={fmtNum(d.kpis.nPrejuizo)}
          cor={d.kpis.nPrejuizo > 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Evolução mensal</h2>
          <GraficoEvolucao dados={d.evolucaoMensal} />
        </div>
        <Link href="/escritorio/dashboard/despesas" className="card block transition hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Estrutura de custos</h2>
            <span className="text-xs text-brand underline">Ver detalhe por rota →</span>
          </div>
          <GraficoEstrutura dados={d.estruturaCustos} />
        </Link>
        <div className="card">
          <h2 className="mb-3 font-semibold">Custo vs. receita por rota</h2>
          <GraficoCustoReceita dados={d.custoVsReceita} />
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Rotas menos rentáveis</h2>
          <GraficoRanking dados={d.rankingMenosRentaveis} />
        </div>
      </div>

      {/* Rentabilidade por cliente */}
      <div className="card scroll-fade-x overflow-x-auto">
        <h2 className="mb-3 font-semibold">Rentabilidade por cliente</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Cliente</th>
              <th className="th text-right">Custo atribuído</th>
              <th className="th text-right">Receita</th>
              <th className="th text-right">Lucro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {d.porCliente.map((c) => (
              <tr key={c.cliente}>
                <td className="td font-medium">{c.cliente}</td>
                <td className="td text-right">{fmtEuro(c.custo)}</td>
                <td className="td text-right">{fmtEuro(c.receita)}</td>
                <td className={`td text-right font-semibold ${c.lucro < 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmtEuro(c.lucro)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-lg font-bold ${cor ?? ""}`}>{valor}</p>
    </div>
  );
}
