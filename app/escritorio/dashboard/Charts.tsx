"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/dashboard-service";

const CORES = ["#1e3a5f", "#2c5282", "#3182ce", "#63b3ed", "#90cdf4", "#bee3f8"];
const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

export function GraficoEvolucao({ dados }: { dados: DashboardData["evolucaoMensal"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="mes" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={eur} width={70} />
        <Tooltip formatter={(v: number) => eur(v)} />
        <Legend />
        <Line type="monotone" dataKey="custo" name="Custo" stroke="#e53e3e" strokeWidth={2} />
        <Line type="monotone" dataKey="receita" name="Receita" stroke="#38a169" strokeWidth={2} />
        <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#1e3a5f" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoCustoReceita({ dados }: { dados: DashboardData["custoVsReceita"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="idRota" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={eur} width={70} />
        <Tooltip formatter={(v: number) => eur(v)} />
        <Legend />
        <Bar dataKey="custo" name="Custo" fill="#e53e3e" />
        <Bar dataKey="receita" name="Receita" fill="#38a169" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoEstrutura({ dados }: { dados: DashboardData["estruturaCustos"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="nome" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={eur} width={70} />
        <Tooltip formatter={(v: number) => eur(v)} />
        <Bar dataKey="valor" name="Custo">
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoRanking({ dados }: { dados: DashboardData["rankingMenosRentaveis"] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 36)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis type="number" fontSize={12} tickFormatter={eur} />
        <YAxis type="category" dataKey="idRota" fontSize={12} width={80} />
        <Tooltip formatter={(v: number) => eur(v)} />
        <Bar dataKey="lucro" name="Lucro">
          {dados.map((d, i) => (
            <Cell key={i} fill={d.lucro < 0 ? "#e53e3e" : "#38a169"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
