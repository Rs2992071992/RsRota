import Link from "next/link";
import { prisma } from "@/lib/db";
import { carregarClientes, carregarCliente } from "@/lib/clientes-service";
import { fmtEuro, fmtPct, fmtData } from "@/lib/format";
import ContatoCliente from "@/components/ContatoCliente";
import ClienteGrafico from "@/components/ClienteGrafico";
import EstadoOrcamentoBadge from "@/components/orcamento/EstadoOrcamentoBadge";

export const dynamic = "force-dynamic";

interface SearchParams {
  cliente?: string;
  q?: string;
}

export default async function ClientesPage({ searchParams }: { searchParams: SearchParams }) {
  const selecionado = searchParams.cliente || "";
  const q = (searchParams.q || "").trim().toLowerCase();

  const [clientes, detalhe, orcamentos] = await Promise.all([
    carregarClientes(),
    selecionado ? carregarCliente(selecionado) : Promise.resolve(null),
    selecionado
      ? prisma.devis.findMany({
          where: { cliente: selecionado },
          orderBy: { criadoEm: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const lista = q ? clientes.filter((c) => c.nome.toLowerCase().includes(q)) : clientes;

  // Preserva a pesquisa atual ao trocar de cliente selecionado.
  const hrefCliente = (nome: string) => {
    const p = new URLSearchParams();
    p.set("cliente", nome);
    if (searchParams.q) p.set("q", searchParams.q);
    return `/escritorio/clientes?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{clientes.length} cliente(s)</span>
          <Link href="/escritorio/clientes/agrupar" className="text-sm font-medium text-brand hover:underline">
            Agrupar clientes
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Lista (mestre) */}
        <div className="card p-0">
          <form method="get" className="border-b border-gray-100 p-3">
            {selecionado && <input type="hidden" name="cliente" value={selecionado} />}
            <input
              name="q"
              defaultValue={searchParams.q}
              placeholder="Procurar cliente…"
              className="input"
            />
          </form>
          <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
            {lista.length === 0 && (
              <li className="px-3 py-4 text-sm text-gray-400">Sem clientes.</li>
            )}
            {lista.map((c) => {
              const ativo = c.nome === selecionado;
              return (
                <li key={c.nome}>
                  <Link
                    href={hrefCliente(c.nome)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                      ativo ? "bg-brand/10 font-semibold" : ""
                    }`}
                  >
                    <span className="truncate">{c.nome}</span>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        c.lucro < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {fmtEuro(c.lucro)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Detalhe */}
        <div className="space-y-4">
          {!detalhe ? (
            <div className="card flex h-40 items-center justify-center text-gray-400">
              {selecionado ? "Cliente sem dados." : "Selecione um cliente à esquerda."}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{detalhe.nome}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    detalhe.lucro < 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {detalhe.lucro < 0 ? "🔴 Prejuízo" : "🟢 OK"}
                </span>
              </div>

              <ContatoCliente nome={detalhe.nome} contacto={detalhe.contacto} />

              {/* Orçamentos do cliente */}
              <div className="card p-0">
                <div className="flex items-center justify-between border-b border-gray-100 p-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Orçamentos ({orcamentos.length})
                  </h3>
                  <Link
                    href={`/escritorio/orcamentos/novo?cliente=${encodeURIComponent(detalhe.nome)}`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    + Novo orçamento
                  </Link>
                </div>
                {orcamentos.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400">Sem orçamentos para este cliente.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="th">Número</th>
                        <th className="th">Data</th>
                        <th className="th">Válido até</th>
                        <th className="th">Estado</th>
                        <th className="th text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orcamentos.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="td font-semibold">
                            <Link
                              href={`/escritorio/orcamentos/${o.id}`}
                              className="text-brand hover:underline"
                            >
                              {o.numero}
                            </Link>
                          </td>
                          <td className="td whitespace-nowrap">{fmtData(o.data)}</td>
                          <td className="td whitespace-nowrap">
                            {o.validade ? fmtData(o.validade) : "—"}
                          </td>
                          <td className="td">
                            <EstadoOrcamentoBadge estado={o.estado} />
                          </td>
                          <td className="td text-right font-semibold">{fmtEuro(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi rotulo="Viagens" valor={String(detalhe.nVoyages)} />
                <Kpi rotulo="Receita" valor={fmtEuro(detalhe.receita)} />
                <Kpi
                  rotulo="Lucro"
                  valor={fmtEuro(detalhe.lucro)}
                  cor={detalhe.lucro < 0 ? "text-red-600" : "text-green-600"}
                />
                <Kpi rotulo="Margem" valor={fmtPct(detalhe.margem)} />
              </div>

              {/* Gráfico */}
              <div className="card">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Rentabilidade por mês</h3>
                <ClienteGrafico serie={detalhe.serie} />
              </div>

              {/* Pagamentos (informativo) */}
              <div className="grid grid-cols-3 gap-3">
                <Kpi rotulo="Já pago" valor={fmtEuro(detalhe.jaPago)} cor="text-green-700" />
                <Kpi rotulo="Por pagar" valor={fmtEuro(detalhe.porPagar)} cor="text-amber-700" />
                <Kpi
                  rotulo="Vencido (+90 d)"
                  valor={fmtEuro(detalhe.vencido)}
                  cor={detalhe.vencido > 0 ? "text-red-700" : undefined}
                />
              </div>

              {/* Viagens */}
              <div className="card overflow-x-auto p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="th">Rota</th>
                      <th className="th">Data</th>
                      <th className="th text-right">Receita</th>
                      <th className="th text-right">Custo</th>
                      <th className="th text-right">Lucro</th>
                      <th className="th">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detalhe.voyages.map((v) => (
                      <tr key={v.idRota} className="hover:bg-gray-50">
                        <td className="td font-semibold">
                          <Link
                            href={`/escritorio/rotas/${encodeURIComponent(v.idRota)}`}
                            className="text-brand hover:underline"
                          >
                            {v.idRota}
                          </Link>
                        </td>
                        <td className="td whitespace-nowrap">{fmtData(v.data)}</td>
                        <td className="td text-right">{fmtEuro(v.receita)}</td>
                        <td className="td text-right">{fmtEuro(v.custo)}</td>
                        <td className={`td text-right font-semibold ${v.lucro < 0 ? "text-red-600" : "text-green-600"}`}>
                          {fmtEuro(v.lucro)}
                        </td>
                        <td className="td">
                          {v.pago ? (
                            <span className="text-green-700">Pago</span>
                          ) : (
                            <span className="text-amber-700">Por pagar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className={`text-lg font-bold ${cor ?? ""}`}>{valor}</p>
    </div>
  );
}
