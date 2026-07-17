"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { derivarCustos } from "@/lib/calc/params";
import type { ParametrosCusto, PneuItem } from "@/lib/calc/types";
import { fmtEuro, fmtNum, fmtNum2 } from "@/lib/format";

type PneuForm = { eixo: string; custo: number; km: number };

export interface ManutencaoBD {
  id: number;
  descricao: string;
  data: string;
  valor: number | null;
  dias: number | null;
}

export interface VeiculoBD {
  id: number;
  nome: string;
  matricula: string | null;
  ativo: boolean;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  iucAnual: number;
  taxaJuros: number;
  seguroAnual: number;
  reparacoesAnuais: number;
  revisaoAnual: number;
  inspecaoAnual: number;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  nParagens: number;
  pneus: PneuForm[];
  manutencoes: ManutencaoBD[];
}

type Template = Omit<VeiculoBD, "id" | "ativo" | "nParagens" | "manutencoes"> & { matricula: string };

interface Props {
  veiculos: VeiculoBD[];
  template: Template;
}

// km anuais de referência só para a pré-visualização do custo/km (o valor real do
// cálculo usa os km anuais do motorista que conduz).
const REF_KM_ANUAIS = 95000;

const CAMPOS_CUSTO: [keyof VeiculoForm, string][] = [
  ["valorAquisicao", "Valor de aquisição (€)"],
  ["valorResidual", "Valor residual (€)"],
  ["vidaUtilAnos", "Vida útil (anos)"],
  ["iucAnual", "IUC anual (€)"],
  ["taxaJuros", "Taxa de juros (fração)"],
  ["seguroAnual", "Seguro anual (€)"],
  ["reparacoesAnuais", "Reparações anuais (€)"],
  ["revisaoAnual", "Revisão anual (€)"],
  ["inspecaoAnual", "Inspeção anual (€)"],
  ["capacidadeCamiao", "Capacidade camião (kg)"],
  ["capacidadeReboque", "Capacidade camião+reboque (kg)"],
  ["capacidadePaleteA", "Capacidade paletes 120x80 (nº)"],
  ["capacidadePaleteB", "Capacidade paletes 120x100 (nº)"],
];

interface VeiculoForm {
  nome: string;
  matricula: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  iucAnual: number;
  taxaJuros: number;
  seguroAnual: number;
  reparacoesAnuais: number;
  revisaoAnual: number;
  inspecaoAnual: number;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  pneus: PneuForm[];
}

function veiculoParaForm(v: VeiculoBD | Template): VeiculoForm {
  return {
    nome: v.nome,
    matricula: v.matricula ?? "",
    valorAquisicao: v.valorAquisicao,
    valorResidual: v.valorResidual,
    vidaUtilAnos: v.vidaUtilAnos,
    iucAnual: v.iucAnual,
    taxaJuros: v.taxaJuros,
    seguroAnual: v.seguroAnual,
    reparacoesAnuais: v.reparacoesAnuais,
    revisaoAnual: v.revisaoAnual,
    inspecaoAnual: v.inspecaoAnual,
    capacidadeCamiao: v.capacidadeCamiao,
    capacidadeReboque: v.capacidadeReboque,
    capacidadePaleteA: v.capacidadePaleteA,
    capacidadePaleteB: v.capacidadePaleteB,
    pneus: v.pneus.map((p) => ({ ...p })),
  };
}

/** Custo veículo/km (pré-visualização, km anuais de referência). */
function custoVeiculoKm(f: VeiculoForm): number {
  const fake: ParametrosCusto = {
    salarioMensal: 0, seguroMensal: 0, percentEncargos: 0, alimentacaoDia: 0,
    diasAlimentacao: 0, kmAnuais: REF_KM_ANUAIS, fatorAnualizacao: 0,
    valorAquisicao: f.valorAquisicao, valorResidual: f.valorResidual,
    vidaUtilAnos: f.vidaUtilAnos, iucAnual: f.iucAnual, taxaJuros: f.taxaJuros,
    seguroAnual: f.seguroAnual, reparacoesAnuais: f.reparacoesAnuais,
    revisaoAnual: f.revisaoAnual, inspecaoAnual: f.inspecaoAnual,
    precoCombRef: 0, precoCombReal: 0, consumoAdblue: 0, precoAdblue: 0,
    margemMinima: 0, valorHoraExtra: 0, valorNoite: 0,
    capacidadeCamiao: f.capacidadeCamiao, capacidadeReboque: f.capacidadeReboque,
    capacidadePaleteA: f.capacidadePaleteA, capacidadePaleteB: f.capacidadePaleteB,
  };
  return derivarCustos(fake, f.pneus as PneuItem[]).custoVeiculoPorKm;
}

export default function VeiculosManager({ veiculos, template }: Props) {
  const router = useRouter();
  // null = nada aberto; "novo" = criar; número = editar veículo com esse id.
  const [edicao, setEdicao] = useState<number | "novo" | null>(null);
  // id do veículo cujas manutenções estão a ser vistas (null = nada aberto).
  const [manutencoesId, setManutencoesId] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Veículos</h1>
        <button onClick={() => setEdicao("novo")} className="btn">
          + Novo veículo
        </button>
      </div>

      {veiculos.length === 0 ? (
        <div className="card text-sm text-gray-500">
          Ainda não há veículos. Crie o primeiro com “Novo veículo”.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {veiculos.map((v) => {
            const totalDias = v.manutencoes.reduce((s, m) => s + (m.dias ?? 0), 0);
            const totalCusto = v.manutencoes.reduce((s, m) => s + (m.valor ?? 0), 0);
            return (
              <div key={v.id} className="card transition hover:border-brand/40">
                <button onClick={() => setEdicao(v.id)} className="block w-full text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{v.nome}</span>
                    {!v.ativo && <span className="text-xs text-gray-400">inativo</span>}
                  </div>
                  <p className="text-sm text-gray-500">
                    {v.matricula || "sem matrícula"} · {v.nParagens} paragem(ns)
                  </p>
                  <p className="mt-2 text-sm">
                    Custo veículo / km:{" "}
                    <span className="font-bold">{fmtNum2(custoVeiculoKm(veiculoParaForm(v)))} €</span>{" "}
                    <span className="text-xs text-gray-400">(ref. {REF_KM_ANUAIS.toLocaleString("pt-PT")} km/ano)</span>
                  </p>
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-xs text-gray-500">
                    {v.manutencoes.length === 0
                      ? "Sem manutenções registadas"
                      : `${v.manutencoes.length} manutenção(ões) · ${fmtEuro(totalCusto)} · ${fmtNum(totalDias)} dia(s) parado`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setManutencoesId(v.id);
                    }}
                    className="btn-secondary text-xs"
                  >
                    Manutenções
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edicao !== null && (
        <VeiculoEditor
          inicial={edicao === "novo" ? veiculoParaForm(template) : veiculoParaForm(veiculos.find((v) => v.id === edicao)!)}
          veiculoId={edicao === "novo" ? null : edicao}
          podeApagar={edicao !== "novo"}
          onClose={() => setEdicao(null)}
          onSaved={() => {
            setEdicao(null);
            router.refresh();
          }}
        />
      )}

      {manutencoesId !== null && (
        <ManutencoesModal
          veiculo={veiculos.find((v) => v.id === manutencoesId)!}
          onClose={() => setManutencoesId(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ManutencoesModal({
  veiculo,
  onClose,
  onChanged,
}: {
  veiculo: VeiculoBD;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [linhas, setLinhas] = useState<ManutencaoBD[]>(veiculo.manutencoes);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [erro, setErro] = useState("");

  const totalDias = linhas.reduce((s, m) => s + (m.dias ?? 0), 0);
  const totalCusto = linhas.reduce((s, m) => s + (m.valor ?? 0), 0);

  function updLocal(id: number, campo: keyof ManutencaoBD, valor: string | number | null) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  async function guardarCampo(id: number, campo: "descricao" | "data" | "valor" | "dias", valor: string | number | null) {
    setErro("");
    try {
      const res = await fetch(`/api/manutencoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao guardar.");
        return;
      }
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    }
  }

  async function adicionar() {
    setErro("");
    setAAdicionar(true);
    try {
      const res = await fetch(`/api/veiculos/${veiculo.id}/manutencoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: "", data: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao adicionar.");
        return;
      }
      const { manutencao } = await res.json();
      setLinhas((ls) => [
        { id: manutencao.id, descricao: manutencao.descricao, data: manutencao.data, valor: manutencao.valor, dias: manutencao.dias },
        ...ls,
      ]);
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAAdicionar(false);
    }
  }

  async function apagar(id: number) {
    if (!confirm("Apagar esta manutenção?")) return;
    setErro("");
    try {
      const res = await fetch(`/api/manutencoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        return;
      }
      setLinhas((ls) => ls.filter((l) => l.id !== id));
      onChanged();
    } catch {
      setErro("Erro de ligação.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Manutenções — {veiculo.nome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Total dias parado</p>
            <p className="font-bold">{fmtNum(totalDias)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Custo total reparações</p>
            <p className="font-bold">{fmtEuro(totalCusto)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="th">Descrição</th>
                <th className="th">Data</th>
                <th className="th">Valor (€)</th>
                <th className="th">Dias parado</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="td">
                    <input
                      className="input"
                      value={l.descricao}
                      onChange={(e) => updLocal(l.id, "descricao", e.target.value)}
                      onBlur={(e) => guardarCampo(l.id, "descricao", e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="date"
                      className="input"
                      value={l.data.slice(0, 10)}
                      onChange={(e) => updLocal(l.id, "data", e.target.value)}
                      onBlur={(e) => guardarCampo(l.id, "data", e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={l.valor ?? ""}
                      placeholder="—"
                      onChange={(e) => updLocal(l.id, "valor", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => guardarCampo(l.id, "valor", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={l.dias ?? ""}
                      placeholder="—"
                      onChange={(e) => updLocal(l.id, "dias", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => guardarCampo(l.id, "dias", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </td>
                  <td className="td">
                    <button onClick={() => apagar(l.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={adicionar} disabled={aAdicionar} className="btn-secondary mt-2 text-sm">
          {aAdicionar ? "A adicionar…" : "+ Nova manutenção"}
        </button>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function VeiculoEditor({
  inicial,
  veiculoId,
  podeApagar,
  onClose,
  onSaved,
}: {
  inicial: VeiculoForm;
  veiculoId: number | null;
  podeApagar: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<VeiculoForm>(inicial);
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "a-apagar">("idle");
  const [erro, setErro] = useState("");

  const custoKm = useMemo(() => custoVeiculoKm(f), [f]);

  function setNum(k: keyof VeiculoForm, v: string) {
    setF((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));
  }

  async function guardar() {
    setErro("");
    if (!f.nome.trim()) {
      setErro("Nome obrigatório.");
      return;
    }
    setEstado("a-gravar");
    try {
      const payload = { ...f, matricula: f.matricula.trim() || null };
      const res = await fetch(veiculoId ? `/api/veiculos/${veiculoId}` : "/api/veiculos", {
        method: veiculoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao guardar.");
        setEstado("idle");
        return;
      }
      onSaved();
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  async function apagar() {
    if (!confirm("Apagar este veículo? As paragens antigas mantêm os custos congelados.")) return;
    setEstado("a-apagar");
    try {
      const res = await fetch(`/api/veiculos/${veiculoId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        setEstado("idle");
        return;
      }
      onSaved();
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{veiculoId ? "Editar veículo" : "Novo veículo"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          Custo veículo / km: <span className="font-bold">{fmtNum2(custoKm)} €</span>{" "}
          <span className="text-xs text-gray-400">(ref. {REF_KM_ANUAIS.toLocaleString("pt-PT")} km/ano)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label">Matrícula</label>
            <input className="input" value={f.matricula} onChange={(e) => setF((p) => ({ ...p, matricula: e.target.value }))} />
          </div>
          {CAMPOS_CUSTO.map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input
                type="number"
                step="any"
                className="input"
                value={f[k] as number}
                onChange={(e) => setNum(k, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <h4 className="mb-2 font-semibold">Pneus por eixo (custo / km)</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Eixo</th>
                  <th className="th">Custo (€)</th>
                  <th className="th">KM de vida</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {f.pneus.map((p, i) => (
                  <tr key={i}>
                    <td className="td">
                      <input className="input" value={p.eixo} onChange={(e) => updPneu(setF, i, "eixo", e.target.value)} />
                    </td>
                    <td className="td">
                      <input type="number" step="any" className="input" value={p.custo} onChange={(e) => updPneu(setF, i, "custo", Number(e.target.value))} />
                    </td>
                    <td className="td">
                      <input type="number" step="any" className="input" value={p.km} onChange={(e) => updPneu(setF, i, "km", Number(e.target.value))} />
                    </td>
                    <td className="td">
                      <button onClick={() => setF((pr) => ({ ...pr, pneus: pr.pneus.filter((_, j) => j !== i) }))} className="text-red-500 hover:text-red-700">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => setF((pr) => ({ ...pr, pneus: [...pr.pneus, { eixo: `${pr.pneus.length + 1} Eixo`, custo: 0, km: 100000 }] }))}
            className="btn-secondary mt-2 text-sm"
          >
            + Adicionar pneu
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between">
          {podeApagar ? (
            <button onClick={apagar} disabled={estado !== "idle"} className="text-sm font-medium text-red-600 hover:text-red-800">
              {estado === "a-apagar" ? "A apagar…" : "Apagar veículo"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} disabled={estado !== "idle"} className="btn">
              {estado === "a-gravar" ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function updPneu(
  setF: React.Dispatch<React.SetStateAction<VeiculoForm>>,
  i: number,
  campo: keyof PneuForm,
  valor: string | number,
) {
  setF((pr) => ({
    ...pr,
    pneus: pr.pneus.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)),
  }));
}
