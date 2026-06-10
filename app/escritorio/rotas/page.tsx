import Link from "next/link";
import { carregarRotas, opcoesFiltro, type FiltrosRota } from "@/lib/rotas-service";
import { fmtEuro, fmtNum, fmtData } from "@/lib/format";
import { AlertaBadge } from "@/components/Badge";
import ApagarRota from "./ApagarRota";
import type { RotaCalc } from "@/lib/calc/types";

export const dynamic = "force-dynamic";

interface SearchParams {
  de?: string;
  ate?: string;
  cliente?: string;
  tipoVeiculo?: string;
  estado?: string;
  sort?: string;
  dir?: string;
}

type SortKey = "data" | "paragens" | "km" | "custo" | "receita" | "lucro";

// Valor numérico ordenável por chave (datas → timestamp).
const sortValue: Record<SortKey, (r: RotaCalc) => number> = {
  data: (r) => r.dataInicio.getTime(),
  paragens: (r) => r.paragens.length,
  km: (r) => r.kmTotais,
  custo: (r) => r.custoTotalRota,
  receita: (r) => r.receitaTotal,
  lucro: (r) => r.lucro,
};

export default async function RotasPage({ searchParams }: { searchParams: SearchParams }) {
  const filtros: FiltrosRota = {
    de: searchParams.de ? new Date(searchParams.de) : undefined,
    ate: searchParams.ate ? new Date(searchParams.ate + "T23:59:59") : undefined,
    cliente: searchParams.cliente || undefined,
    tipoVeiculo: searchParams.tipoVeiculo || undefined,
    estado: searchParams.estado || undefined,
  };

  const [rotas, opcoes] = await Promise.all([carregarRotas(filtros), opcoesFiltro()]);

  // Ordenação dinâmica por clique no cabeçalho. Sem `sort`, mantém-se a ordem
  // por defeito do serviço (lucro crescente — as rotas problemáticas primeiro).
  const sort = (searchParams.sort as SortKey) || undefined;
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  if (sort && sortValue[sort]) {
    const f = sortValue[sort];
    rotas.sort((a, b) => (dir === "asc" ? f(a) - f(b) : f(b) - f(a)));
  }

  // Constrói o href de ordenação preservando os filtros atuais e alternando dir.
  const sortHref = (key: SortKey) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "sort" && k !== "dir") params.set(k, String(v));
    }
    params.set("sort", key);
    params.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    return `/escritorio/rotas?${params.toString()}`;
  };

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
              <SortableTh label="Data" sortKey="data" sort={sort} dir={dir} hrefFor={sortHref} />
              <SortableTh label="Paragens" sortKey="paragens" sort={sort} dir={dir} hrefFor={sortHref} />
              <SortableTh label="KM" sortKey="km" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Custo" sortKey="custo" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Receita" sortKey="receita" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Lucro" sortKey="lucro" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <th className="th">Alerta</th>
              <th className="th text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rotas.length === 0 && (
              <tr>
                <td className="td text-gray-400" colSpan={9}>
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
                <td className="td whitespace-nowrap">
                  {r.dataInicio.getTime() === r.dataFim.getTime()
                    ? fmtData(r.dataInicio)
                    : `${fmtData(r.dataInicio)} – ${fmtData(r.dataFim)}`}
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
                <td className="td text-right">
                  <ApagarRota idRota={r.idRota} nParagens={r.paragens.length} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  sort,
  dir,
  hrefFor,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort?: SortKey;
  dir: "asc" | "desc";
  hrefFor: (key: SortKey) => string;
  align?: "right";
}) {
  const ativo = sort === sortKey;
  const seta = ativo ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <th className={`th ${align === "right" ? "text-right" : ""}`}>
      <Link
        href={hrefFor(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-brand ${ativo ? "text-brand" : ""}`}
      >
        {label}
        <span className="text-[10px]">{seta}</span>
      </Link>
    </th>
  );
}
