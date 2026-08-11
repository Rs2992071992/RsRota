import { prisma } from "@/lib/db";
import { fmtEuro } from "@/lib/format";
import { estadoPagamento } from "@/lib/calc/pagamentos";
import CobrancasTabela, { type LinhaCobranca } from "@/components/CobrancasTabela";

export const dynamic = "force-dynamic";

// Ordem por defeito: vencidos primeiro, depois a aguardar, pagos no fim.
const PRIORIDADE = { VENCIDO: 0, A_AGUARDAR: 1, PAGO: 2 } as const;

export default async function ContasAReceber() {
  const paragens = await prisma.paragem.findMany({
    where: { receitaPaga: { gt: 0 } },
    select: { id: true, idRota: true, cliente: true, data: true, receitaPaga: true, pago: true },
  });

  const linhas: LinhaCobranca[] = paragens
    .map((p) => {
      const info = estadoPagamento(p.data, p.pago);
      return {
        id: p.id,
        idRota: p.idRota,
        cliente: p.cliente,
        valor: p.receitaPaga,
        pago: p.pago,
        estado: info.estado,
        diasRestantes: info.diasRestantes,
        dataVencimento: info.dataVencimento.toISOString(),
      };
    })
    .sort((a, b) => {
      const pa = PRIORIDADE[a.estado];
      const pb = PRIORIDADE[b.estado];
      if (pa !== pb) return pa - pb;
      return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
    });

  const porReceber = linhas.filter((l) => !l.pago).reduce((a, l) => a + l.valor, 0);
  const vencido = linhas.filter((l) => l.estado === "VENCIDO").reduce((a, l) => a + l.valor, 0);
  const nVencidos = linhas.filter((l) => l.estado === "VENCIDO").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Contas a receber</h1>
        <p className="text-sm text-gray-500">
          Os clientes têm 90 dias (a contar da data da paragem) para pagar. Os valores vencidos
          (+90 dias) aparecem primeiro. Clique num título de coluna para ordenar.
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

      <div className="card scroll-fade-x overflow-x-auto">
        {linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Sem valores a cobrar registados.</p>
        ) : (
          <CobrancasTabela linhas={linhas} />
        )}
      </div>
    </div>
  );
}
