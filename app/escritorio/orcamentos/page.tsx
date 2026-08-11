import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtEuro, fmtData } from "@/lib/format";
import EstadoOrcamentoBadge from "@/components/orcamento/EstadoOrcamentoBadge";
import ApagarOrcamento from "@/components/orcamento/ApagarOrcamento";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  const devis = await prisma.devis.findMany({ orderBy: { criadoEm: "desc" } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orçamentos</h1>
        <Link href="/escritorio/orcamentos/novo" className="btn">
          Novo orçamento
        </Link>
      </div>

      <div className="card scroll-fade-x overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Número</th>
              <th className="th">Cliente</th>
              <th className="th">Data</th>
              <th className="th">Válido até</th>
              <th className="th">Estado</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devis.length === 0 && (
              <tr>
                <td className="td text-gray-400" colSpan={7}>
                  Ainda não há orçamentos. Crie o primeiro com “Novo orçamento”.
                </td>
              </tr>
            )}
            {devis.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="td font-semibold">
                  <Link
                    href={`/escritorio/orcamentos/${d.id}`}
                    className="text-brand hover:underline"
                  >
                    {d.numero}
                  </Link>
                </td>
                <td className="td">{d.cliente}</td>
                <td className="td whitespace-nowrap">{fmtData(d.data)}</td>
                <td className="td whitespace-nowrap">
                  {d.validade ? fmtData(d.validade) : "—"}
                </td>
                <td className="td">
                  <EstadoOrcamentoBadge estado={d.estado} />
                </td>
                <td className="td text-right font-semibold">{fmtEuro(d.total)}</td>
                <td className="td text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/escritorio/orcamentos/${d.id}`}
                      className="text-sm text-brand hover:underline"
                    >
                      Abrir
                    </Link>
                    <ApagarOrcamento id={d.id} numero={d.numero} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
