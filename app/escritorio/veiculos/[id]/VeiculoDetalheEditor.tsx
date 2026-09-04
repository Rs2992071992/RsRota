"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { custoVeiculoKm, formatarErrosVeiculo, type VeiculoForm } from "@/lib/veiculo-form";
import { fmtNum2 } from "@/lib/format";
import VeiculoCamposForm from "@/components/VeiculoCamposForm";
import ManutencoesModal, { type ManutencaoBD } from "../ManutencoesModal";
import PedidoManutencaoModal from "../PedidoManutencaoModal";

export default function VeiculoDetalheEditor({
  veiculoId,
  veiculoNome,
  inicial,
  manutencoesIniciais,
  reboques,
}: {
  veiculoId: number;
  veiculoNome: string;
  inicial: VeiculoForm;
  manutencoesIniciais: ManutencaoBD[];
  reboques: { id: number; nome: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState<VeiculoForm>(inicial);
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "a-apagar">("idle");
  const [erro, setErro] = useState("");
  const [manutencoesAbertas, setManutencoesAbertas] = useState(false);
  const [pedidoAberto, setPedidoAberto] = useState(false);

  const custoKm = useMemo(() => custoVeiculoKm(f), [f]);

  async function guardar() {
    setErro("");
    if (!f.nome.trim()) {
      setErro("Nome obrigatório.");
      return;
    }
    setEstado("a-gravar");
    try {
      const payload = { ...f, matricula: f.matricula.trim() || null };
      const res = await fetch(`/api/veiculos/${veiculoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(formatarErrosVeiculo(data.detalhes) ?? data.erro ?? "Erro ao guardar.");
        setEstado("idle");
        return;
      }
      setEstado("idle");
      router.refresh();
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
      router.push("/escritorio/veiculos");
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        {f.categoria === "PESADO" ? (
          <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            Custo veículo / km: <span className="font-bold">{fmtNum2(custoKm)} €</span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => setPedidoAberto(true)} className="btn-secondary text-sm">
            + Pedido de manutenção
          </button>
          <button onClick={() => setManutencoesAbertas(true)} className="btn-secondary text-sm">
            Manutenções
          </button>
        </div>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

      <VeiculoCamposForm f={f} setF={setF} reboques={reboques} />

      <div className="mt-5 flex items-center justify-between">
        <button onClick={apagar} disabled={estado !== "idle"} className="text-sm font-medium text-red-600 hover:text-red-800">
          {estado === "a-apagar" ? "A apagar…" : "Apagar veículo"}
        </button>
        <button onClick={guardar} disabled={estado !== "idle"} className="btn">
          {estado === "a-gravar" ? "A guardar…" : "Guardar"}
        </button>
      </div>

      {manutencoesAbertas && (
        <ManutencoesModal
          veiculoId={veiculoId}
          veiculoNome={veiculoNome}
          manutencoesIniciais={manutencoesIniciais}
          onClose={() => setManutencoesAbertas(false)}
          onChanged={() => router.refresh()}
        />
      )}

      {pedidoAberto && (
        <PedidoManutencaoModal
          veiculoId={veiculoId}
          veiculoNome={veiculoNome}
          onClose={() => setPedidoAberto(false)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
