import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtEuro, fmtData } from "@/lib/format";
import { estadoPagamento } from "@/lib/calc/pagamentos";
import EstadoPagamentoBadge from "@/components/EstadoPagamentoBadge";
import PagoToggle from "@/components/PagoToggle";

export const dynamic = "force-dynamic";

// Ordem de prioridade na lista: vencidos primeiro, depois a aguardar, pagos no fim.
const PRIORIDADE = { VENCIDO: 0, A_AGUARDAR: 1, PAGO: 2 } as const;

export default async function ContasAReceber() {
  const paragens = await prisma.paragem.findMany({
    where: { receitaPaga: { gt: 0 } },
    select: { id: true, idRota: true, cliente: true, data: true, receitaPaga: true, pago: true },
  });

  const linhas = paragens
    .map((p) => ({ ...p, info: estadoPagamento(p.data, p.pago) }))
    .sort((a, b) => {
      const pa = PRIORIDADE[a.info.estado];
      const pb = PRIORIDADE[b.info.estado];
      if (pa !== pb) return pa - pb;
      // Dentro do mesmo estado: vencimento mais próximo primeiro.
      return a.info.dataVencimento.getTime() - b.info.dataVencimento.getTime();
    });

  const porReceber = linhas.filter((l) => !l.pago).reduce((a, l) => a + l.receitaPaga, 0);
  const vencido = linhas
    .filter((l) => l.info.estado === "VENCIDO")
    .reduce((a, l) => a + l.receitaPaga, 0);
  const nVencidos = linhas.filter((l) => l.info.estado === "VENCIDO").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Contas a receber</h1>
        <p className="text-sm text-gray-500">
          Os clientes têm 90 dias (a contar da data da paragem) para pagar. Os valores vencidos
          (+90 dias) aparecem primeiro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card">
          <p className="text-xs text-gray-500">Por receber (total)</p>
          <p className="text-lg font-bold text-amber-700">{fmtEuro(porReceber)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Vencido (+90 d)</p>
          <p className={`text-lg font-bold ${vencido > 0 ? "text-red-700" : ""}`}>{fmtEuro(vencido)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Nº paragens vencidas</p>
          <p className={`text-lg font-bold ${nVencidos > 0 ? "text-red-700" : ""}`}>{nVencidos}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Sem valores a cobrar registados.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Rota</th>
                <th className="th">Cliente</th>
                <th className="th text-right">Valor</th>
                <th className="th">Vence</th>
                <th className="th">Estado</th>
                <th className="th text-right">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l) => (
                <tr key={l.id} className={l.info.estado === "VENCIDO" ? "bg-red-50/40" : ""}>
                  <td className="td">
                    <Link href={`/escritorio/rotas/${encodeURIComponent(l.idRota)}`} className="font-medium text-brand hover:underline">
                      {l.idRota}
                    </Link>
                  </td>
                  <td className="td">{l.cliente}</td>
                  <td className="td text-right">{fmtEuro(l.receitaPaga)}</td>
                  <td className="td">{fmtData(l.info.dataVencimento)}</td>
                  <td className="td">
                    <EstadoPagamentoBadge estado={l.info.estado} dias={l.info.diasRestantes} />
                  </td>
                  <td className="td text-right">
                    <PagoToggle paragemId={l.id} pago={l.pago} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
