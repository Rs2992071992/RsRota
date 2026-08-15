import Link from "next/link";
import { carregarPoupancaEspanha } from "@/lib/dashboard-service";
import { fmtEuro, fmtNum2, fmtData } from "@/lib/format";

export const dynamic = "force-dynamic";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${ano}`;
}

export default async function PoupancaEspanhaPage() {
  const d = await carregarPoupancaEspanha();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/escritorio/dashboard" className="text-sm text-brand underline">
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Poupança combustível — Espanha</h1>
        <p className="text-sm text-gray-500">
          Comparação do custo pago em Espanha com o preço de referência em vigor nesse dia. Puramente
          informativo — não entra em nenhum custo/lucro calculado.
        </p>
      </div>

      {d.porDia.length === 0 ? (
        <div className="card text-gray-500">
          Ainda não há nenhum abastecimento registado como "Abasteci em Espanha".
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card">
              <p className="text-xs text-gray-500">Poupança últimos 12 meses</p>
              <p className={`text-lg font-bold ${d.totalUltimos12Meses < 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtEuro(d.totalUltimos12Meses)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500">Poupança total</p>
              <p className={`text-lg font-bold ${d.totalGeral < 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtEuro(d.totalGeral)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500">Litros abastecidos em Espanha</p>
              <p className="text-lg font-bold">{fmtNum2(d.litrosTotal)} L</p>
            </div>
          </div>

          <div className="card scroll-fade-x overflow-x-auto">
            <h2 className="mb-3 font-semibold">Por mês</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="th">Mês</th>
                  <th className="th text-right">Litros</th>
                  <th className="th text-right">Poupança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.porMes.map((m) => (
                  <tr key={m.mes}>
                    <td className="td font-medium">{rotuloMes(m.mes)}</td>
                    <td className="td text-right">{fmtNum2(m.litros)} L</td>
                    <td
                      className={`td text-right font-semibold ${m.poupanca < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {fmtEuro(m.poupanca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card scroll-fade-x overflow-x-auto">
            <h2 className="mb-3 font-semibold">Por abastecimento</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="th">Data</th>
                  <th className="th">Rota</th>
                  <th className="th">Cliente</th>
                  <th className="th text-right">Litros</th>
                  <th className="th text-right">Preço ref.</th>
                  <th className="th text-right">Custo pago</th>
                  <th className="th text-right">Poupança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.porDia.map((r, i) => (
                  <tr key={i}>
                    <td className="td whitespace-nowrap">{fmtData(r.data)}</td>
                    <td className="td">
                      <Link href={`/escritorio/rotas/${encodeURIComponent(r.idRota)}`} className="text-brand underline">
                        {r.idRota}
                      </Link>
                    </td>
                    <td className="td">{r.cliente}</td>
                    <td className="td text-right">{fmtNum2(r.litros)} L</td>
                    <td className="td text-right">{fmtEuro(r.precoCombRef)}/L</td>
                    <td className="td text-right">{fmtEuro(r.custoEspanha)}</td>
                    <td
                      className={`td text-right font-semibold ${r.poupanca < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {fmtEuro(r.poupanca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
