import Link from "next/link";
import { carregarDespesasDetalhe, type DespesaPorRota } from "@/lib/dashboard-service";
import { fmtEuro, fmtData } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  sort?: string;
  dir?: string;
}

type SortKey = "idRota" | "data" | "combustivel" | "motorista" | "veiculo" | "portagens" | "adblue" | "extras" | "total";

const sortValue: Record<SortKey, (r: DespesaPorRota) => number | string> = {
  idRota: (r) => r.idRota,
  data: (r) => r.data.getTime(),
  combustivel: (r) => r.combustivel,
  motorista: (r) => r.motorista,
  veiculo: (r) => r.veiculo,
  portagens: (r) => r.portagens,
  adblue: (r) => r.adblue,
  extras: (r) => r.extras,
  total: (r) => r.total,
};

export default async function DespesasDetalhe(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const linhas = await carregarDespesasDetalhe();

  // Por defeito (sem `sort`), maior custo total primeiro. A pedido: também
  // é possível organizar por rota mais recente, clicando no cabeçalho "Data".
  const sort: SortKey = (searchParams.sort as SortKey) && sortValue[searchParams.sort as SortKey]
    ? (searchParams.sort as SortKey)
    : "total";
  const semSort = !searchParams.sort;
  const dir = searchParams.dir === "asc" ? "asc" : searchParams.dir === "desc" ? "desc" : semSort ? "desc" : "asc";
  const f = sortValue[sort];
  linhas.sort((a, b) => {
    const va = f(a);
    const vb = f(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return dir === "asc" ? cmp : -cmp;
  });

  const sortHref = (key: SortKey) => {
    const params = new URLSearchParams();
    params.set("sort", key);
    params.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    return `/escritorio/dashboard/despesas?${params.toString()}`;
  };

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
          Clique num cabeçalho para organizar (ex. "Data" para ver as rotas mais recentes primeiro).
        </p>
      </div>

      <div className="card scroll-fade-x overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh label="Rota" sortKey="idRota" sort={sort} dir={dir} hrefFor={sortHref} />
              <SortableTh label="Data" sortKey="data" sort={sort} dir={dir} hrefFor={sortHref} />
              <SortableTh label="Combustível" sortKey="combustivel" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Motorista" sortKey="motorista" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Veículo" sortKey="veiculo" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Portagens" sortKey="portagens" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="AdBlue" sortKey="adblue" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Noites/Alim./Horas" sortKey="extras" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
              <SortableTh label="Total" sortKey="total" sort={sort} dir={dir} hrefFor={sortHref} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.map((r) => (
              <tr key={r.idRota} className="hover:bg-gray-50">
                <td className="td font-medium">
                  <Link href={`/escritorio/rotas/${encodeURIComponent(r.idRota)}`} className="text-brand underline">
                    {r.idRota}
                  </Link>
                </td>
                <td className="td whitespace-nowrap">{fmtData(r.data)}</td>
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
              <td className="td font-bold" colSpan={2}>
                Total
              </td>
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
  sort: SortKey;
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
