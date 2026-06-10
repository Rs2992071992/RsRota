import Link from "next/link";
import { carregarRotas, opcoesFiltro, type FiltrosRota } from "@/lib/rotas-service";
import { fmtEuro, fmtNum } from "@/lib/format";
import { AlertaBadge } from "@/components/Badge";

export const dynamic = "force-dynamic";

interface SearchParams {
  de?: string;
  ate?: string;
  cliente?: string;
  tipoVeiculo?: string;
  estado?: string;
}

export default async function RotasPage({ searchParams }: { searchParams: SearchParams }) {
  const filtros: FiltrosRota = {
    de: searchParams.de ? new Date(searchParams.de) : undefined,
    ate: searchParams.ate ? new Date(searchParams.ate + "T23:59:59") : undefined,
    cliente: searchParams.cliente || undefined,
    tipoVeiculo: searchParams.tipoVeiculo || undefined,
    estado: searchParams.estado || undefined,
  };

  const [rotas, opcoes] = await Promise.all([carregarRotas(filtros), opcoesFiltro()]);

  const totalCusto = rotas.reduce((a, r) => a + r.custoTotalRota, 0);
  const totalReceita = rotas.reduce((a, r) => a + r.receitaTotal, 0);
  const totalLucro = totalReceita - totalCusto;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rotas</h1>
        <span className="text-sm text-gray-500">{rotas.length} rota(s)</span>
      </div>

      {/* Filtros */}
      <form className="card grid grid-cols-2 gap-3 md:grid-cols-5" method="get">
        <div>
          <label className="label">De</label>
          <input type="date" name="de" defaultValue={searchParams.de} className="input" />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" name="ate" defaultValue={searchParams.ate} className="input" />
        </div>
        <div>
          <label className="label">Cliente</label>
          <select name="cliente" defaultValue={searchParams.cliente} className="input">
            <option value="">Todos</option>
            {opcoes.clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Veículo</label>
          <select name="tipoVeiculo" defaultValue={searchParams.tipoVeiculo} className="input">
            <option value="">Todos</option>
            {opcoes.tiposVeiculo.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={searchParams.estado} className="input">
            <option value="">Todos</option>
            <option value="lucro">🟢 Lucro</option>
            <option value="prejuizo">🔴 Prejuízo</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-5">
          <button className="btn">Filtrar</button>
          <Link href="/escritorio/rotas" className="btn-secondary">
            Limpar
          </Link>
        </div>
      </form>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500">Custo total</p>
          <p className="text-lg font-bold">{fmtEuro(totalCusto)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Receita total</p>
          <p className="text-lg font-bold">{fmtEuro(totalReceita)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Lucro total</p>
          <p className={`text-lg font-bold ${totalLucro < 0 ? "text-red-600" : "text-green-600"}`}>
            {fmtEuro(totalLucro)}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">ID Rota</th>
              <th className="th">Paragens</th>
              <th className="th text-right">KM</th>
              <th className="th text-right">Custo</th>
              <th className="th text-right">Receita</th>
              <th className="th text-right">Lucro</th>
              <th className="th">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rotas.length === 0 && (
              <tr>
                <td className="td text-gray-400" colSpan={7}>
                  Sem rotas para os filtros escolhidos.
                </td>
              </tr>
            )}
            {rotas.map((r) => (
              <tr key={r.idRota} className="hover:bg-gray-50">
                <td className="td font-semibold">
                  <Link href={`/escritorio/rotas/${encodeURIComponent(r.idRota)}`} className="text-brand hover:underline">
                    {r.idRota}
                  </Link>
                </td>
                <td className="td">{r.paragens.length}</td>
                <td className="td text-right">{fmtNum(r.kmTotais)}</td>
                <td className="td text-right">{fmtEuro(r.custoTotalRota)}</td>
                <td className="td text-right">{fmtEuro(r.receitaTotal)}</td>
                <td className={`td text-right font-semibold ${r.lucro < 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmtEuro(r.lucro)}
                </td>
                <td className="td">
                  <AlertaBadge alerta={r.alerta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
