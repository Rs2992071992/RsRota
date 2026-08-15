import Link from "next/link";
import { carregarDespesasDetalhe } from "@/lib/dashboard-service";
import { fmtEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DespesasDetalhe() {
  const linhas = await carregarDespesasDetalhe();

  const totais = linhas.reduce(
    (a, r) => ({
      combustivel: a.combustivel + r.combustivel,
      motorista: a.motorista + r.motorista,
      veiculo: a.veiculo + r.veiculo,
      portagens: a.portagens + r.portagens,
      adblue: a.adblue + r.adblue,
      extras: a.extras + r.extras,
      total: a.total + r.total,
    }),
    { combustivel: 0, motorista: 0, veiculo: 0, portagens: 0, adblue: 0, extras: 0, total: 0 },
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/escritorio/dashboard" className="text-sm text-brand underline">
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Estrutura de custos — por rota</h1>
        <p className="text-sm text-gray-500">
          Cada categoria discriminada por rota; a soma de todas as linhas dá os totais do gráfico no dashboard.
        </p>
      </div>

      <div className="card scroll-fade-x overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Rota</th>
              <th className="th text-right">Combustível</th>
              <th className="th text-right">Motorista</th>
              <th className="th text-right">Veículo</th>
              <th className="th text-right">Portagens</th>
              <th className="th text-right">AdBlue</th>
              <th className="th text-right">Noites/Alim./Horas</th>
              <th className="th text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.map((r) => (
              <tr key={r.idRota}>
                <td className="td font-medium">
                  <Link href={`/escritorio/rotas/${encodeURIComponent(r.idRota)}`} className="text-brand underline">
                    {r.idRota}
                  </Link>
                </td>
                <td className="td text-right">{fmtEuro(r.combustivel)}</td>
                <td className="td text-right">{fmtEuro(r.motorista)}</td>
                <td className="td text-right">{fmtEuro(r.veiculo)}</td>
                <td className="td text-right">{fmtEuro(r.portagens)}</td>
                <td className="td text-right">{fmtEuro(r.adblue)}</td>
                <td className="td text-right">{fmtEuro(r.extras)}</td>
                <td className="td text-right font-semibold">{fmtEuro(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50">
            <tr>
              <td className="td font-bold">Total</td>
              <td className="td text-right font-bold">{fmtEuro(totais.combustivel)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.motorista)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.veiculo)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.portagens)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.adblue)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.extras)}</td>
              <td className="td text-right font-bold">{fmtEuro(totais.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
