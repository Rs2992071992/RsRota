import type { EstadoPagamento } from "@/lib/calc/pagamentos";

/** Badge do estado de cobrança (🟢 Pago / 🟡 a aguardar / 🔴 vencido). */
export default function EstadoPagamentoBadge({
  estado,
  dias,
}: {
  estado: EstadoPagamento;
  dias: number;
}) {
  if (estado === "PAGO") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        🟢 Pago
      </span>
    );
  }
  if (estado === "VENCIDO") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        🔴 Vencido (+{Math.abs(dias)} d)
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      🟡 faltam {dias} d
    </span>
  );
}
