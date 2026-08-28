"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { fmtEuro, fmtNum, fmtNum2 } from "@/lib/format";
import {
  REF_KM_ANUAIS,
  custoVeiculoKm,
  veiculoParaForm,
  type PneuForm,
  type VeiculoForm,
} from "@/lib/veiculo-form";
import VeiculoCamposForm from "@/components/VeiculoCamposForm";
import type { ManutencaoBD } from "./ManutencoesModal";

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
  capacidadePaleteACamiao: number;
  capacidadePaleteBCamiao: number;
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
  reboqueHabitualId: number | null;
  fatorOcupacaoPalete: number;
  nParagens: number;
  pneus: PneuForm[];
  manutencoes: ManutencaoBD[];
}

type Template = Omit<VeiculoBD, "id" | "ativo" | "nParagens" | "manutencoes"> & { matricula: string };

interface Props {
  veiculos: VeiculoBD[];
  template: Template;
  avariasPendentes: number;
  reboques: { id: number; nome: string }[];
}

export default function VeiculosManager({ veiculos, template, avariasPendentes, reboques }: Props) {
  const router = useRouter();
  const [criarAberto, setCriarAberto] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Veículos</h1>
        <div className="flex items-center gap-4">
          <Link href="/escritorio/veiculos/avarias" className="btn-secondary relative gap-2">
            <Wrench size={16} strokeWidth={2} />
            Ped. Manutenção
            {avariasPendentes > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white shadow">
                {avariasPendentes}
              </span>
            )}
          </Link>
          <button onClick={() => setCriarAberto(true)} className="btn">
            + Novo veículo
          </button>
        </div>
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
              <Link
                key={v.id}
                href={`/escritorio/veiculos/${v.id}`}
                className="card block transition hover:border-brand/40"
              >
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
                <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                  {v.manutencoes.length === 0
                    ? "Sem manutenções registadas"
                    : `${v.manutencoes.length} manutenção(ões) · ${fmtEuro(totalCusto)} · ${fmtNum(totalDias)} dia(s) parado`}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {criarAberto && (
        <NovoVeiculoModal
          inicial={veiculoParaForm(template)}
          reboques={reboques}
          onClose={() => setCriarAberto(false)}
          onSaved={() => {
            setCriarAberto(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NovoVeiculoModal({
  inicial,
  reboques,
  onClose,
  onSaved,
}: {
  inicial: VeiculoForm;
  reboques: { id: number; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<VeiculoForm>(inicial);
  const [estado, setEstado] = useState<"idle" | "a-gravar">("idle");
  const [erro, setErro] = useState("");

  async function guardar() {
    setErro("");
    if (!f.nome.trim()) {
      setErro("Nome obrigatório.");
      return;
    }
    setEstado("a-gravar");
    try {
      const payload = { ...f, matricula: f.matricula.trim() || null };
      const res = await fetch("/api/veiculos", {
        method: "POST",
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Novo veículo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <VeiculoCamposForm f={f} setF={setF} reboques={reboques} />

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={estado !== "idle"} className="btn">
            {estado === "a-gravar" ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
