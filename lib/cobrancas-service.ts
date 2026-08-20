// Camada de tesouraria (cobranças) — carrega as linhas por pagar/pagas a
// partir de Paragem.receitaPaga, com o estado de prazo (lib/calc/pagamentos).
// Partilhada entre a página /escritorio/cobrancas e a rota do PDF, para não
// duplicar a query+mapeamento.

import { prisma } from "@/lib/db";
import { estadoPagamento, type EstadoPagamento } from "@/lib/calc/pagamentos";
import { mapaClienteEmpresa } from "@/lib/empresas-service";

export interface LinhaCobranca {
  id: number;
  idRota: string;
  cliente: string;
  /** Empresa-mãe a quem se cobra este cliente (Cliente.empresaId); null = ainda não atribuída. */
  empresa: string | null;
  valor: number;
  pago: boolean;
  estado: EstadoPagamento;
  diasRestantes: number;
  dataVencimento: string; // ISO
  data: string; // ISO — data da paragem
}

// Ordem por defeito: vencidos primeiro, depois a aguardar, pagos no fim.
const PRIORIDADE: Record<EstadoPagamento, number> = { VENCIDO: 0, A_AGUARDAR: 1, PAGO: 2 };

/** Todas as linhas de cobrança (paragens com receitaPaga > 0), ordenadas por urgência. */
export async function carregarCobrancas(): Promise<LinhaCobranca[]> {
  const [paragens, mapaEmpresa] = await Promise.all([
    prisma.paragem.findMany({
      where: { receitaPaga: { gt: 0 } },
      select: { id: true, idRota: true, cliente: true, data: true, receitaPaga: true, pago: true },
    }),
    mapaClienteEmpresa(),
  ]);

  return paragens
    .map((p) => {
      const info = estadoPagamento(p.data, p.pago);
      return {
        id: p.id,
        idRota: p.idRota,
        cliente: p.cliente,
        empresa: mapaEmpresa.get(p.cliente) ?? null,
        valor: p.receitaPaga,
        pago: p.pago,
        estado: info.estado,
        diasRestantes: info.diasRestantes,
        dataVencimento: info.dataVencimento.toISOString(),
        data: p.data.toISOString(),
      };
    })
    .sort((a, b) => {
      const pa = PRIORIDADE[a.estado];
      const pb = PRIORIDADE[b.estado];
      if (pa !== pb) return pa - pb;
      return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
    });
}
