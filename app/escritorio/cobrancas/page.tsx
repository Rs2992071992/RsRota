import { fmtEuro } from "@/lib/format";
import { carregarCobrancas } from "@/lib/cobrancas-service";
import CobrancasTabela from "@/components/CobrancasTabela";
import DescarregarPdfBotao from "@/components/DescarregarPdfBotao";

export const dynamic = "force-dynamic";

export default async function ContasAReceber() {
  const linhas = await carregarCobrancas();

  const porReceber = linhas.filter((l) => !l.pago).reduce((a, l) => a + l.valor, 0);
  const vencido = linhas.filter((l) => l.estado === "VENCIDO").reduce((a, l) => a + l.valor, 0);
  const nVencidos = linhas.filter((l) => l.estado === "VENCIDO").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas a receber</h1>
          <p className="text-sm text-gray-500">
            Os clientes têm 90 dias (a contar da data da paragem) para pagar. Os valores vencidos
            (+90 dias) aparecem primeiro. Clique num título de coluna para ordenar.
          </p>
        </div>
        {linhas.length > 0 && (
          <DescarregarPdfBotao url="/api/cobrancas/pdf" nomeFicheiro="contas-a-receber" />
        )}
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
