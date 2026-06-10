// Camada de tesouraria (cobranças). Os clientes têm 90 dias, a contar da data da
// paragem, para pagar o valor faturado. Lógica pura e testável — não toca no
// cálculo de custo/lucro (esse vive em perRoute/perStop).

export const PRAZO_DIAS = 90;

const MS_DIA = 24 * 60 * 60 * 1000;

export type EstadoPagamento = "PAGO" | "A_AGUARDAR" | "VENCIDO";

export interface InfoPagamento {
  estado: EstadoPagamento;
  /** Data limite de pagamento = data da paragem + 90 dias. */
  dataVencimento: Date;
  /** Dias até ao vencimento: > 0 ainda há prazo, <= 0 em atraso (só relevante se não pago). */
  diasRestantes: number;
}

/** Adiciona dias a uma data sem mutar o original. */
function adicionarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * MS_DIA);
}

/** Diferença em dias inteiros entre duas datas (a − b), arredondada para baixo. */
function diffDias(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_DIA);
}

/**
 * Estado de cobrança de uma paragem.
 * - `pago` → PAGO.
 * - não pago e dentro do prazo (hoje <= vencimento) → A_AGUARDAR (diasRestantes >= 0).
 * - não pago e fora do prazo (hoje > vencimento) → VENCIDO (diasRestantes < 0).
 */
export function estadoPagamento(
  data: Date | string,
  pago: boolean,
  hoje: Date = new Date(),
): InfoPagamento {
  const base = data instanceof Date ? data : new Date(data);
  const dataVencimento = adicionarDias(base, PRAZO_DIAS);
  const diasRestantes = diffDias(dataVencimento, hoje);

  let estado: EstadoPagamento;
  if (pago) estado = "PAGO";
  else if (diasRestantes >= 0) estado = "A_AGUARDAR";
  else estado = "VENCIDO";

  return { estado, dataVencimento, diasRestantes };
}
