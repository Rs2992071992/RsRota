"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { derivarCustos } from "@/lib/calc/params";
import type { ParametrosCusto, PneuItem } from "@/lib/calc/types";
import { fmtEuro, fmtNum2 } from "@/lib/format";

type ParamsBD = ParametrosCusto & { id: number; atualizadoEm: Date };
type Pneu = { eixo: string; custo: number; km: number };
type Portagem = { zona: string; valor: number };
type Consumo = { cargaKg: number; consumoL100: number };

interface Props {
  paramsIniciais: ParamsBD;
  pneusIniciais: Pneu[];
  portagensIniciais: Portagem[];
  consumoIniciais: Consumo[];
}

const grupos: { titulo: string; campos: [keyof ParametrosCusto, string][] }[] = [
  {
    titulo: "Motorista (valores por defeito)",
    campos: [
      ["salarioMensal", "Salário mensal (€)"],
      ["seguroMensal", "Seguro mensal (€)"],
      ["percentEncargos", "Encargos empresa (fração, ex. 0,235)"],
      ["alimentacaoDia", "Alimentação por dia (€)"],
      ["diasAlimentacao", "Dias de alimentação"],
      ["kmAnuais", "KM anuais de referência"],
      ["fatorAnualizacao", "Fator anualização (14 salários PT)"],
    ],
  },
  {
    titulo: "Veículo (valores por defeito)",
    campos: [
      ["valorAquisicao", "Valor de aquisição (€)"],
      ["valorResidual", "Valor residual (€)"],
      ["vidaUtilAnos", "Vida útil (anos)"],
      ["iucAnual", "IUC anual (€)"],
      ["taxaJuros", "Taxa de juros (fração, ex. 0,02)"],
      ["seguroAnual", "Seguro anual (€)"],
      ["reparacoesAnuais", "Reparações anuais (€)"],
      ["revisaoAnual", "Revisão anual (€)"],
      ["inspecaoAnual", "Inspeção anual (€)"],
    ],
  },
  {
    titulo: "Combustível / AdBlue",
    campos: [
      ["precoCombRef", "Preço ref. combustível (€/L) — entra no cálculo"],
      ["precoCombReal", "Preço real combustível (€/L) — informativo"],
      ["consumoAdblue", "Consumo AdBlue (L/100km)"],
      ["precoAdblue", "Preço AdBlue (€/L)"],
    ],
  },
  {
    titulo: "Outros",
    campos: [
      ["margemMinima", "Margem mínima (fator, ex. 1,25)"],
      ["valorHoraExtra", "Valor hora extra (€)"],
      ["valorNoite", "Valor por noite fora (€)"],
      ["capacidadeCamiao", "Capacidade camião (kg)"],
      ["capacidadeReboque", "Capacidade camião+reboque (kg)"],
    ],
  },
  {
    titulo: "Paletes (tipo veículo = Palete 120×80 / 120×100)",
    campos: [
      ["capacidadePaleteA", "Capacidade paletes 120×80cm (nº por camião)"],
      ["capacidadePaleteB", "Capacidade paletes 120×100cm (nº por camião)"],
    ],
  },
];

export default function ParametrosForm({
  paramsIniciais,
  pneusIniciais,
  portagensIniciais,
  consumoIniciais,
}: Props) {
  const router = useRouter();
  const [params, setParams] = useState<ParametrosCusto>(extrair(paramsIniciais));
  const [pneus, setPneus] = useState<Pneu[]>(pneusIniciais);
  const [portagens, setPortagens] = useState<Portagem[]>(portagensIniciais);
  const [consumo, setConsumo] = useState<Consumo[]>(consumoIniciais);
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "ok" | "erro">("idle");

  // Valores derivados em tempo real (mesma função pura usada no backend).
  const derivados = useMemo(
    () => derivarCustos(params, pneus as PneuItem[]),
    [params, pneus],
  );

  function setParam(k: keyof ParametrosCusto, v: string) {
    setParams((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  }

  async function guardar() {
    setEstado("a-gravar");
    try {
      const res = await fetch("/api/parametros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, pneus, portagens, consumo }),
      });
      if (!res.ok) {
        setEstado("erro");
        return;
      }
      setEstado("ok");
      router.refresh();
      setTimeout(() => setEstado("idle"), 2000);
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parâmetros</h1>
        <button onClick={guardar} disabled={estado === "a-gravar"} className="btn">
          {estado === "a-gravar"
            ? "A guardar…"
            : estado === "ok"
              ? "✓ Guardado"
              : "Guardar tudo"}
        </button>
      </div>
      {estado === "erro" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Erro ao guardar.</p>
      )}

      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
        Os blocos <strong>Motorista</strong> e <strong>Veículo</strong> abaixo são apenas os{" "}
        <strong>valores por defeito</strong> (modelo para novos motoristas/veículos). Os custos
        reais de cada motorista editam-se em <strong>Motoristas</strong> e os de cada camião em{" "}
        <strong>Veículos</strong>.
      </p>
      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
        Os pneus aqui são o <strong>template global</strong>; cada veículo tem os seus próprios na
        página de Veículos.
      </p>

      {/* Valores derivados (validação) */}
      <div className="card border-brand/30 bg-brand/5">
        <h2 className="mb-3 font-semibold text-brand">Valores derivados (recalculados ao vivo)</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Derivado titulo="Custo motorista / km" valor={`${fmtNum2(derivados.custoMotoristaPorKm)} €`} />
          <Derivado titulo="Custo veículo / km" valor={`${fmtNum2(derivados.custoVeiculoPorKm)} €`} />
          <Derivado titulo="Custo mensal motorista" valor={fmtEuro(derivados.detalhe.custoMensalMotorista)} />
          <Derivado titulo="Custos fixos anuais" valor={fmtEuro(derivados.detalhe.custosFixosAnuais)} />
          <Derivado titulo="Depreciação anual" valor={fmtEuro(derivados.detalhe.depreciacaoAnual)} />
          <Derivado titulo="Custo fixo anual / km" valor={`${fmtNum2(derivados.detalhe.custoFixoAnualKm)} €`} />
          <Derivado titulo="Manutenção / km" valor={`${fmtNum2(derivados.detalhe.manutencaoKm)} €`} />
          <Derivado titulo="Pneus / km" valor={`${fmtNum2(derivados.detalhe.pneusKm)} €`} />
        </div>
      </div>

      {/* Grupos de parâmetros */}
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <div key={g.titulo} className="card">
            <h3 className="mb-3 font-semibold">{g.titulo}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.campos.map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={params[k]}
                    onChange={(e) => setParam(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pneus */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Pneus por eixo (custo / km)</h3>
        <TabelaEditavel
          colunas={["Eixo", "Custo (€)", "KM de vida"]}
          linhas={pneus}
          render={(p, i) => [
            <input key="e" className="input" value={p.eixo} onChange={(e) => upd(setPneus, i, "eixo", e.target.value)} />,
            <input key="c" type="number" step="any" className="input" value={p.custo} onChange={(e) => upd(setPneus, i, "custo", Number(e.target.value))} />,
            <input key="k" type="number" step="any" className="input" value={p.km} onChange={(e) => upd(setPneus, i, "km", Number(e.target.value))} />,
          ]}
          onAdd={() => setPneus((a) => [...a, { eixo: `${a.length + 1} Eixo`, custo: 0, km: 100000 }])}
          onDel={(i) => setPneus((a) => a.filter((_, j) => j !== i))}
        />
      </div>

      {/* Portagens */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Tabela de portagens (classe 4, só de ida)</h3>
        <TabelaEditavel
          colunas={["Zona", "Valor (€)"]}
          linhas={portagens}
          render={(p, i) => [
            <input key="z" className="input" value={p.zona} onChange={(e) => upd(setPortagens, i, "zona", e.target.value)} />,
            <input key="v" type="number" step="any" className="input" value={p.valor} onChange={(e) => upd(setPortagens, i, "valor", Number(e.target.value))} />,
          ]}
          onAdd={() => setPortagens((a) => [...a, { zona: "", valor: 0 }])}
          onDel={(i) => setPortagens((a) => a.filter((_, j) => j !== i))}
        />
      </div>

      {/* Consumo */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Tabela de consumo por carga (escalão inferior)</h3>
        <TabelaEditavel
          colunas={["Carga (kg)", "Consumo (L/100km)"]}
          linhas={consumo}
          render={(c, i) => [
            <input key="c" type="number" step="any" className="input" value={c.cargaKg} onChange={(e) => upd(setConsumo, i, "cargaKg", Number(e.target.value))} />,
            <input key="l" type="number" step="any" className="input" value={c.consumoL100} onChange={(e) => upd(setConsumo, i, "consumoL100", Number(e.target.value))} />,
          ]}
          onAdd={() => setConsumo((a) => [...a, { cargaKg: 0, consumoL100: 0 }])}
          onDel={(i) => setConsumo((a) => a.filter((_, j) => j !== i))}
        />
      </div>

      <div className="flex justify-end">
        <button onClick={guardar} disabled={estado === "a-gravar"} className="btn">
          {estado === "a-gravar" ? "A guardar…" : estado === "ok" ? "✓ Guardado" : "Guardar tudo"}
        </button>
      </div>
    </div>
  );
}

function Derivado({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="font-bold">{valor}</p>
    </div>
  );
}

function TabelaEditavel<T>({
  colunas,
  linhas,
  render,
  onAdd,
  onDel,
}: {
  colunas: string[];
  linhas: T[];
  render: (linha: T, i: number) => React.ReactNode[];
  onAdd: () => void;
  onDel: (i: number) => void;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c} className="th">
                  {c}
                </th>
              ))}
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                {render(l, i).map((cell, j) => (
                  <td key={j} className="td">
                    {cell}
                  </td>
                ))}
                <td className="td">
                  <button onClick={() => onDel(i)} className="text-red-500 hover:text-red-700">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="btn-secondary mt-2 text-sm">
        + Adicionar linha
      </button>
    </div>
  );
}

function upd<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  i: number,
  campo: keyof T,
  valor: T[keyof T],
) {
  setter((arr) => arr.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
}

function extrair(p: ParamsBD): ParametrosCusto {
  const {
    id: _id,
    atualizadoEm: _a,
    ...rest
  } = p;
  return rest;
}
