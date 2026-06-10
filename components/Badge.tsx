export function AlertaBadge({ alerta }: { alerta: string }) {
  const prejuizo = alerta.includes("PREJUÍZO");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        prejuizo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      }`}
    >
      {alerta}
    </span>
  );
}
