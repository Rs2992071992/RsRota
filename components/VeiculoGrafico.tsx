"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum } from "@/lib/format";

const kg = (v: number) => `${fmtNum(v)} kg`;

/** Evolução mensal dos kg carregados por um veículo, ao longo do ano corrente. */
export default function VeiculoGrafico({ serie }: { serie: { mes: string; kg: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={serie}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="mes" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={kg} width={70} />
        <Tooltip formatter={(v: number) => kg(v)} />
        <Bar dataKey="kg" name="Kg carregados" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
