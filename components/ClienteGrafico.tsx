"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v || 0);

/** Evolução mensal do lucro atribuído a um cliente. Barras verdes/vermelhas (sinal). */
export default function ClienteGrafico({ serie }: { serie: { mes: string; lucro: number }[] }) {
  if (serie.length === 0) {
    return <p className="text-sm text-gray-400">Sem dados para mostrar.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={serie}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="mes" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={eur} width={70} />
        <Tooltip formatter={(v: number) => eur(v)} />
        <Bar dataKey="lucro" name="Lucro">
          {serie.map((d, i) => (
            <Cell key={i} fill={d.lucro < 0 ? "#e53e3e" : "#38a169"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
