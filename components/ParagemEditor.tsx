"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULOS_TIPO_PALETE, TIPOS_PALETE, TIPOS_VEICULO, TIPOS_VIAGEM } from "@/lib/validacao";

/** Campos editáveis de uma paragem (subconjunto do modelo Prisma). */
export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
}

/** Tipo de palete do catálogo (dimensões reais, mm) — ver /escritorio/cargas. */
export interface TipoPaleteOpcao {
  id: number;
  nome: string;
}

export interface ParagemEditavel {
  id: number;
  idRota: string;
  data: string; // ISO (yyyy-mm-dd)
  tipoViagem: string;
  tipoVeiculo: string;
  veiculoId: number | null;
  cliente: string;
  kmInicial: number;
  kmFinal: number;
  // ⚠️ Legado (paragens registadas antes de 2026-08-28) — ver tipoPaleteId abaixo.
  kgCarregados: number;
  kgDescarregados: number;
  volume: boolean;
  tipoPalete: string | null;
  nPaletes: number;
  // Meias-paletes empilhadas — não ocupam base própria, valem metade no rateio.
  nMeiasPaletes: number;
  // Palete desta paragem (2026-08-28 em diante).
  tipoPaleteId: number | null;
  pesoAproximado: number | null;
  zonaPortagem: string;
  portagensExtra: number;
  noitesFora: number;
  alimentacao: number;
  horasExtra: number;
  /** Recolha para entregar a outro cliente — nome a faturar, ou null para faturar a este. */
  faturarCliente: string | null;
  litrosEspanha: number | null;
  custoEspanha: number | null;
  receitaPaga: number;
}

interface Props {
  paragem: ParagemEditavel;
  zonas: string[];
  veiculos: VeiculoOpcao[];
  tiposPalete: TipoPaleteOpcao[];
  /** Nomes de clientes conhecidos, para o dropdown "Faturar esta recolha a". */
  clientes: string[];
  valorNoite: number;
  /** Mostrar o campo "Receita paga" (só no escritório). */
  mostrarReceita?: boolean;
  /** Mostrar o detalhe "N × valor = total" nas Noites fora (só no escritório). */
  mostrarDetalheEuroNoites?: boolean;
  /** Mostrar "Faturar esta recolha a" — a quem faturar é decisão do escritório, não do motorista. */
  mostrarFaturarCliente?: boolean;
  onClose: () => void;
}

export default function ParagemEditor({
  paragem,
  zonas,
  veiculos,
  tiposPalete,
  clientes,
  valorNoite,
  mostrarReceita = false,
  mostrarDetalheEuroNoites = true,
  mostrarFaturarCliente = true,
  onClose,
}: Props) {
  const router = useRouter();
  const [f, setF] = useState({
    ...paragem,
    veiculoId: paragem.veiculoId === null ? "" : String(paragem.veiculoId),
    tipoPaleteId: paragem.tipoPaleteId === null ? "" : String(paragem.tipoPaleteId),
    pesoAproximado: paragem.pesoAproximado === null ? "" : String(paragem.pesoAproximado),
    data: paragem.data.slice(0, 10),
  });
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "a-apagar">("idle");
  const [erro, setErro] = useState("");

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  // Modo desta paragem, a partir dos dados que já tem: "paletes" (2026-08-28
  // em diante, tipoPaleteId), "paletes-legado" (tipoPalete string, antes
  // disso) ou "kg" (peso — a esmagadora maioria do histórico). O escritório
  // pode converter kg/legado -> paletes manualmente (botão abaixo) quando
  // decidir; nunca o inverso (não faz sentido voltar a peso).
  const [modo, setModo] = useState<"kg" | "paletes-legado" | "paletes">(
    paragem.tipoPaleteId != null ? "paletes" : paragem.volume ? "paletes-legado" : "kg",
  );

  // VAZIO: não há carga nenhuma.
  function setTipoVeiculo(v: string) {
    setF((prev) => ({
      ...prev,
      tipoVeiculo: v,
      volume: v === "VAZIO" ? false : prev.volume,
      tipoPalete: v === "VAZIO" ? null : prev.tipoPalete,
      tipoPaleteId: v === "VAZIO" ? "" : prev.tipoPaleteId,
    }));
  }

  // Converte esta paragem (kg ou palete legado) para o modo novo (dimensão) —
  // limpa os campos que deixam de fazer sentido, mesmo princípio do antigo
  // "Volume (paletes)". Não afeta o coeficienteCarga/rateio até se escolher
  // um tipo de palete e "Guardar".
  function converterParaPaletesNovo() {
    setModo("paletes");
    setF((prev) => ({
      ...prev,
      volume: false,
      tipoPalete: null,
      kgCarregados: 0,
      kgDescarregados: 0,
    }));
  }

  async function guardar() {
    setErro("");
    if (Number(f.kmFinal) < Number(f.kmInicial)) {
      setErro("KM Final deve ser ≥ KM Inicial.");
      return;
    }
    if (modo === "paletes" && f.tipoVeiculo !== "VAZIO" && (!f.tipoPaleteId || Number(f.nPaletes) <= 0)) {
      setErro("Escolha o tipo de palete e o nº de paletes.");
      return;
    }
    setEstado("a-gravar");
    try {
      const payload = {
        idRota: f.idRota.trim(),
        data: f.data,
        tipoViagem: f.tipoViagem,
        tipoVeiculo: f.tipoVeiculo,
        veiculoId: f.veiculoId ? Number(f.veiculoId) : null,
        cliente: f.cliente.trim(),
        kmInicial: Number(f.kmInicial),
        kmFinal: Number(f.kmFinal),
        kgCarregados: modo === "kg" ? Number(f.kgCarregados) : 0,
        kgDescarregados: modo === "kg" ? Number(f.kgDescarregados) : 0,
        volume: modo === "paletes-legado",
        tipoPalete: modo === "paletes-legado" ? f.tipoPalete : null,
        nPaletes: modo === "kg" ? 0 : Number(f.nPaletes),
        nMeiasPaletes: modo === "paletes" ? Number(f.nMeiasPaletes) || 0 : 0,
        tipoPaleteId: modo === "paletes" && f.tipoPaleteId ? Number(f.tipoPaleteId) : null,
        pesoAproximado: f.pesoAproximado === "" ? null : Number(f.pesoAproximado),
        zonaPortagem: f.zonaPortagem.trim(),
        portagensExtra: Number(f.portagensExtra),
        noitesFora: Number(f.noitesFora),
        alimentacao: Number(f.alimentacao),
        horasExtra: Number(f.horasExtra),
        faturarCliente: f.faturarCliente?.trim() || null,
        litrosEspanha: f.litrosEspanha === null || f.litrosEspanha === ("" as never) ? null : Number(f.litrosEspanha),
        custoEspanha: f.custoEspanha === null || f.custoEspanha === ("" as never) ? null : Number(f.custoEspanha),
        ...(mostrarReceita ? { receitaPaga: Number(f.receitaPaga) } : {}),
      };
      const res = await fetch(`/api/paragens/${paragem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Erro ao guardar.");
        setEstado("idle");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  async function apagar() {
    if (!confirm("Apagar esta paragem? Esta ação não pode ser anulada.")) return;
    setEstado("a-apagar");
    try {
      const res = await fetch(`/api/paragens/${paragem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao apagar.");
        setEstado("idle");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
      setEstado("idle");
    }
  }

  const campo = (k: keyof typeof f, label: string, type = "number") => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        className="input"
        value={f[k] === null ? "" : (f[k] as string | number)}
        onChange={(e) => set(k, (type === "number" ? e.target.value : e.target.value) as never)}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Editar paragem — {f.cliente || "(sem cliente)"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">ID Rota</label>
            <input className="input" value={f.idRota} onChange={(e) => set("idRota", e.target.value)} />
          </div>
          {campo("data", "Data", "date")}
          <div>
            <label className="label">Cliente / Local</label>
            <input className="input" value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </div>
          {mostrarFaturarCliente && (
            <div className="col-span-2">
              <label className="label">Faturar esta recolha a</label>
              <select
                className="input"
                value={f.faturarCliente ?? ""}
                onChange={(e) => set("faturarCliente", (e.target.value || null) as never)}
              >
                <option value="">— faturar normalmente a este cliente —</option>
                {clientes
                  .filter((c) => c !== f.cliente)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Tipo Viagem</label>
            <select className="input" value={f.tipoViagem} onChange={(e) => set("tipoViagem", e.target.value)}>
              {TIPOS_VIAGEM.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo Veículo</label>
            <select className="input" value={f.tipoVeiculo} onChange={(e) => setTipoVeiculo(e.target.value)}>
              {/* Inclui o valor atual mesmo que já não esteja na lista (ex.: dados antigos). */}
              {Array.from(new Set([f.tipoVeiculo, ...TIPOS_VEICULO])).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Veículo (camião)</label>
            <select
              className="input"
              value={f.veiculoId}
              onChange={(e) => set("veiculoId", e.target.value as never)}
            >
              <option value="">— sem veículo —</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                  {v.matricula ? ` (${v.matricula})` : ""}
                </option>
              ))}
            </select>
          </div>
          {campo("kmInicial", "KM Inicial")}
          {campo("kmFinal", "KM Final")}
          {f.tipoVeiculo !== "VAZIO" && modo !== "paletes" && (
            <div className="col-span-2">
              <button
                type="button"
                onClick={converterParaPaletesNovo}
                className="text-sm font-medium text-brand hover:underline"
              >
                Converter para paletes (por dimensão) →
              </button>
            </div>
          )}
          {f.tipoVeiculo === "VAZIO" ? null : modo === "paletes" ? (
            <>
              <div>
                <label className="label">Tipo de palete</label>
                <select
                  className="input"
                  value={f.tipoPaleteId}
                  onChange={(e) => set("tipoPaleteId", e.target.value as never)}
                >
                  <option value="">— escolher —</option>
                  {tiposPalete.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nº de paletes</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="input"
                  value={f.nPaletes}
                  onChange={(e) => set("nPaletes", (e.target.value === "" ? 0 : Number(e.target.value)) as never)}
                />
              </div>
              <div>
                <label className="label">Nº de meias-paletes — opcional</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Em cima de outras, não ocupam base"
                  className="input"
                  value={f.nMeiasPaletes}
                  onChange={(e) => set("nMeiasPaletes", (e.target.value === "" ? 0 : Number(e.target.value)) as never)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Peso aproximado (kg) — opcional</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Só para estimar o consumo de combustível"
                  className="input"
                  value={f.pesoAproximado}
                  onChange={(e) => set("pesoAproximado", e.target.value as never)}
                />
              </div>
            </>
          ) : modo === "paletes-legado" ? (
            <>
              <div>
                <label className="label">Tipo de palete (legado)</label>
                <select
                  className="input"
                  value={f.tipoPalete ?? ""}
                  onChange={(e) => set("tipoPalete", e.target.value as never)}
                >
                  <option value="">— escolher —</option>
                  {TIPOS_PALETE.map((t) => (
                    <option key={t} value={t}>
                      {ROTULOS_TIPO_PALETE[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nº de paletes</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="input"
                  value={f.nPaletes}
                  onChange={(e) => set("nPaletes", (e.target.value === "" ? 0 : Number(e.target.value)) as never)}
                />
              </div>
            </>
          ) : (
            <>
              {campo("kgCarregados", "KG Carregados")}
              {campo("kgDescarregados", "KG Descarregados")}
            </>
          )}
          <div className="col-span-2">
            <label className="label">Zona Portagem</label>
            <input
              list="zonas-editor"
              className="input"
              value={f.zonaPortagem}
              onChange={(e) => set("zonaPortagem", e.target.value)}
            />
            <datalist id="zonas-editor">
              {zonas.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          {campo("portagensExtra", "Portagens Extra (€)")}
          {campo("alimentacao", "Alimentação (€)")}
          <div>
            <label className="label">Noites fora (nº)</label>
            <input
              type="number"
              step="1"
              min="0"
              className="input"
              value={f.noitesFora}
              onChange={(e) => set("noitesFora", e.target.value as never)}
            />
            {mostrarDetalheEuroNoites && (
              <p className="mt-1 text-xs text-gray-500">
                {Number(f.noitesFora) > 0
                  ? `${Number(f.noitesFora)} × ${valorNoite.toFixed(2)} € = ${(Number(f.noitesFora) * valorNoite).toFixed(2)} €`
                  : `Valor por noite: ${valorNoite.toFixed(2)} €`}
              </p>
            )}
          </div>
          {campo("horasExtra", "Horas Extra")}
          {campo("litrosEspanha", "Litros Espanha")}
          {campo("custoEspanha", "Custo Espanha (€)")}
          {mostrarReceita && campo("receitaPaga", "Valor a cobrar (€)")}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={apagar}
            disabled={estado !== "idle"}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            {estado === "a-apagar" ? "A apagar…" : "Apagar paragem"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={guardar} disabled={estado !== "idle"} className="btn">
              {estado === "a-gravar" ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
