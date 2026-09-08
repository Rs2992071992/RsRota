"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULOS_TIPO_PALETE, TIPOS_PALETE, TIPOS_VEICULO, TIPOS_VIAGEM } from "@/lib/validacao";
import { pesoAproximadoCarregadoEfetivo, pesoAproximadoDescarregado } from "@/lib/calc/perStop";

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
  // Várias linhas de palete na mesma paragem (2026-09+) — tamanhos diferentes.
  // null = paragem de linha única (usa tipoPaleteId/nPaletes acima). `sentido`
  // (Descarga+Recolha, 2026-09+) distingue descarregadas (ENTREGA) de
  // carregadas (RECOLHA); ausente = segue o `recolha` da paragem.
  paletes:
    | { tipoPaleteId: number | null; comprimentoMm: number; larguraMm: number; nPaletes: number; sentido?: "ENTREGA" | "RECOLHA" }[]
    | null;
  /** Recolha (ou Descarga+Recolha, se `paletes` tiver os dois sentidos). */
  recolha: boolean;
  /** Peso aproximado DESCARREGADO (kg) — ver lib/calc/perStop.ts para o fallback
   * de paragens antigas de RECOLHA pura. */
  pesoAproximado: number | null;
  /** Peso aproximado RECOLHIDO/carregado (kg), 2026-09+. */
  pesoAproximadoCarregado: number | null;
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
  /** Atribuição manual do custo deste troço a clientes (km) — só relevante se VAZIO. */
  rateioManual: { cliente: string; km: number }[] | null;
}

interface Props {
  paragem: ParagemEditavel;
  zonas: string[];
  veiculos: VeiculoOpcao[];
  tiposPalete: TipoPaleteOpcao[];
  /** Nomes de clientes conhecidos, para o dropdown "Faturar esta recolha a". */
  clientes: string[];
  /** Clientes desta rota (rota.rateio) — para a atribuição manual de km de um troço VAZIO. */
  clientesRota?: string[];
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
  clientesRota = [],
  valorNoite,
  mostrarReceita = false,
  mostrarDetalheEuroNoites = true,
  mostrarFaturarCliente = true,
  onClose,
}: Props) {
  const router = useRouter();
  // Sentido de cada linha existente: explícito (`sentido`) ou, na falta dele,
  // o da paragem inteira (`recolha`). Mista = tem linhas dos 2 sentidos.
  const sentidoLinha = (l: { sentido?: "ENTREGA" | "RECOLHA" }) => l.sentido ?? (paragem.recolha ? "RECOLHA" : "ENTREGA");
  const todasLinhas = paragem.paletes ?? [];
  const eraMista =
    todasLinhas.some((l) => sentidoLinha(l) === "ENTREGA") && todasLinhas.some((l) => sentidoLinha(l) === "RECOLHA");
  const [tipoParagem, setTipoParagem] = useState<"DESCARGA" | "RECOLHA" | "MISTA">(
    eraMista ? "MISTA" : paragem.recolha ? "RECOLHA" : "DESCARGA",
  );
  // Linhas descarregadas (DESCARGA/MISTA) ou, em RECOLHA pura, o único bloco
  // (o que foi apanhado): a 1.ª vive em f.tipoPaleteId/f.nPaletes, as
  // restantes em `linhasExtra`.
  const linhasBase = eraMista ? todasLinhas.filter((l) => sentidoLinha(l) === "ENTREGA") : todasLinhas;
  const linha0 = linhasBase[0] ?? null;
  const [linhasExtra, setLinhasExtra] = useState<{ tipoPaleteId: string; nPaletes: string }[]>(
    linhasBase.slice(1).map((l) => ({
      tipoPaleteId: l.tipoPaleteId === null ? "" : String(l.tipoPaleteId),
      nPaletes: String(l.nPaletes),
    })),
  );
  // Linhas carregadas — só existiam (e só se mostram) em MISTA.
  const linhasCarregadasIniciais = eraMista ? todasLinhas.filter((l) => sentidoLinha(l) === "RECOLHA") : [];
  const [linhasCarregadas, setLinhasCarregadas] = useState<{ tipoPaleteId: string; nPaletes: string }[]>(
    linhasCarregadasIniciais.length > 0
      ? linhasCarregadasIniciais.map((l) => ({
          tipoPaleteId: l.tipoPaleteId === null ? "" : String(l.tipoPaleteId),
          nPaletes: String(l.nPaletes),
        }))
      : [{ tipoPaleteId: "", nPaletes: "" }],
  );
  const tinhaPaletesMulti = (paragem.paletes?.length ?? 0) > 1;

  const [f, setF] = useState({
    ...paragem,
    veiculoId: paragem.veiculoId === null ? "" : String(paragem.veiculoId),
    tipoPaleteId:
      linha0?.tipoPaleteId != null
        ? String(linha0.tipoPaleteId)
        : paragem.tipoPaleteId === null
          ? ""
          : String(paragem.tipoPaleteId),
    nPaletes: linha0 ? linha0.nPaletes : paragem.nPaletes,
    // Via os helpers de fallback (não os campos crus): uma paragem antiga
    // (RECOLHA pura, registada antes de pesoAproximadoCarregado existir) mostra
    // o valor já no campo certo — e ao Guardar, migra-se sozinha (ver payload).
    pesoAproximado: (() => {
      const v = pesoAproximadoDescarregado(paragem);
      return v ? String(v) : "";
    })(),
    pesoAproximadoCarregado: (() => {
      const v = pesoAproximadoCarregadoEfetivo(paragem);
      return v ? String(v) : "";
    })(),
    data: paragem.data.slice(0, 10),
  });
  const [estado, setEstado] = useState<"idle" | "a-gravar" | "a-apagar">("idle");
  const [erro, setErro] = useState("");

  // Atribuição manual de km deste troço (só relevante se VAZIO) — um input por
  // cliente da rota, pré-preenchido a partir do que já estiver guardado.
  const [kmPorCliente, setKmPorCliente] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const r of paragem.rateioManual ?? []) inicial[r.cliente] = String(r.km);
    return inicial;
  });
  const totalKmAtribuido = Object.values(kmPorCliente).reduce((a, v) => a + (Number(v) || 0), 0);

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

  // VAZIO: não há carga nenhuma nem cliente a faturar (reposicionamento) —
  // preenche "Vazio" automaticamente (mesmo padrão do registo do motorista,
  // RegistoForm.tsx::setTipoVeiculo) para o escritório não ser obrigado a
  // escrever um cliente ao corrigir uma paragem para VAZIO; ao sair de VAZIO,
  // limpa esse valor para se escrever o cliente real.
  function setTipoVeiculo(v: string) {
    if (v === "VAZIO") {
      setLinhasExtra([]);
      setLinhasCarregadas([{ tipoPaleteId: "", nPaletes: "" }]);
      setTipoParagem("DESCARGA");
    }
    setF((prev) => ({
      ...prev,
      tipoVeiculo: v,
      volume: v === "VAZIO" ? false : prev.volume,
      tipoPalete: v === "VAZIO" ? null : prev.tipoPalete,
      tipoPaleteId: v === "VAZIO" ? "" : prev.tipoPaleteId,
      cliente:
        v === "VAZIO" ? "Vazio" : prev.tipoVeiculo === "VAZIO" && prev.cliente === "Vazio" ? "" : prev.cliente,
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
    if (modo === "paletes" && f.tipoVeiculo !== "VAZIO") {
      if (linhasExtra.some((l) => !l.tipoPaleteId || Number(l.nPaletes) <= 0)) {
        setErro("Cada linha de palete precisa de tipo e nº de paletes.");
        return;
      }
      if (tipoParagem === "MISTA") {
        if (linhasCarregadas.some((l) => (l.tipoPaleteId || l.nPaletes) && (!l.tipoPaleteId || Number(l.nPaletes) <= 0))) {
          setErro("Cada linha de palete carregada precisa de tipo e nº de paletes.");
          return;
        }
        const temAlgo =
          (f.tipoPaleteId && Number(f.nPaletes) > 0) ||
          Number(f.nMeiasPaletes) > 0 ||
          linhasCarregadas.some((l) => l.tipoPaleteId && Number(l.nPaletes) > 0);
        if (!temAlgo) {
          setErro("Indique paletes descarregadas ou carregadas.");
          return;
        }
      } else if (!f.tipoPaleteId || (Number(f.nPaletes) <= 0 && Number(f.nMeiasPaletes) <= 0)) {
        setErro("Escolha o tipo de palete e o nº de paletes (inteiras ou meias).");
        return;
      }
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
        // `paletes`: em MISTA, sempre (precisa do `sentido` por linha); fora
        // disso, só quando há (ou havia) mais do que uma linha, ou a paragem
        // deixou de ser mista agora (para limpar as linhas RECOLHA antigas).
        // Array vazio = voltar a linha única. Ausente = linha única, sem mexer.
        paletes:
          modo !== "paletes" || f.tipoVeiculo === "VAZIO"
            ? undefined
            : tipoParagem === "MISTA"
              ? [
                  ...(f.tipoPaleteId && Number(f.nPaletes) > 0
                    ? [{ tipoPaleteId: Number(f.tipoPaleteId), nPaletes: Number(f.nPaletes), sentido: "ENTREGA" as const }]
                    : []),
                  ...linhasExtra.map((l) => ({
                    tipoPaleteId: Number(l.tipoPaleteId),
                    nPaletes: Number(l.nPaletes),
                    sentido: "ENTREGA" as const,
                  })),
                  ...linhasCarregadas
                    .filter((l) => l.tipoPaleteId && Number(l.nPaletes) > 0)
                    .map((l) => ({ tipoPaleteId: Number(l.tipoPaleteId), nPaletes: Number(l.nPaletes), sentido: "RECOLHA" as const })),
                ]
              : linhasExtra.length > 0 || tinhaPaletesMulti || eraMista
                ? linhasExtra.length > 0
                  ? [
                      { tipoPaleteId: Number(f.tipoPaleteId), nPaletes: Number(f.nPaletes) },
                      ...linhasExtra.map((l) => ({
                        tipoPaleteId: Number(l.tipoPaleteId),
                        nPaletes: Number(l.nPaletes),
                      })),
                    ]
                  : []
                : undefined,
        ...(modo === "paletes" ? { recolha: tipoParagem !== "DESCARGA" } : {}),
        // Descarregado só faz sentido em DESCARGA/MISTA; recolhido só em RECOLHA/MISTA
        // (fora do modo paletes, tipoParagem fica sempre "DESCARGA" — comportamento inalterado).
        pesoAproximado:
          tipoParagem === "RECOLHA" || f.pesoAproximado === "" ? null : Number(f.pesoAproximado),
        pesoAproximadoCarregado:
          tipoParagem === "DESCARGA" || f.pesoAproximadoCarregado === ""
            ? null
            : Number(f.pesoAproximadoCarregado),
        zonaPortagem: f.zonaPortagem.trim(),
        portagensExtra: Number(f.portagensExtra),
        noitesFora: Number(f.noitesFora),
        alimentacao: Number(f.alimentacao),
        horasExtra: Number(f.horasExtra),
        faturarCliente: f.faturarCliente?.trim() || null,
        rateioManual:
          f.tipoVeiculo === "VAZIO"
            ? Object.entries(kmPorCliente)
                .filter(([, v]) => Number(v) > 0)
                .map(([cliente, v]) => ({ cliente, km: Number(v) }))
            : null,
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
            {f.tipoVeiculo === "VAZIO" ? (
              <p className="input flex items-center bg-gray-50 text-gray-500">Vazio — sem cliente a faturar</p>
            ) : (
              <input className="input" value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />
            )}
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
          {f.tipoVeiculo === "VAZIO" ? (
            <div className="col-span-2 rounded-lg border border-gray-200 p-3">
              <p className="mb-1 text-sm font-medium text-gray-700">
                Atribuir km deste troço vazio a clientes (opcional)
              </p>
              <p className="mb-2 text-xs text-gray-500">
                Por defeito, o custo deste troço dilui-se automaticamente pelos clientes da rota.
                Indique aqui quantos km atribuir a cada um para o substituir — o que não for
                coberto continua a diluir-se como sempre.
              </p>
              {clientesRota.length === 0 ? (
                <p className="text-xs text-gray-400">Sem outros clientes nesta rota ainda.</p>
              ) : (
                <div className="space-y-2">
                  {clientesRota.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">{c}</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        className="input w-24"
                        value={kmPorCliente[c] ?? ""}
                        onChange={(e) =>
                          setKmPorCliente((prev) => ({ ...prev, [c]: e.target.value }))
                        }
                      />
                      <span className="text-xs text-gray-400">km</span>
                    </div>
                  ))}
                  <p
                    className={`text-xs ${
                      totalKmAtribuido > 0 && totalKmAtribuido !== Number(f.kmFinal) - Number(f.kmInicial)
                        ? "text-amber-600"
                        : "text-gray-500"
                    }`}
                  >
                    Total: {totalKmAtribuido} km (de {Number(f.kmFinal) - Number(f.kmInicial)} km neste troço)
                  </p>
                </div>
              )}
            </div>
          ) : modo === "paletes" ? (
            <>
              <div className="col-span-2">
                <label className="label">Tipo de paragem</label>
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
                  {(
                    [
                      ["DESCARGA", "Descarga"],
                      ["RECOLHA", "Recolha"],
                      ["MISTA", "Descarga + Recolha"],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTipoParagem(valor)}
                      className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${
                        tipoParagem === valor ? "bg-white text-brand shadow-sm" : "text-gray-500"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              {tipoParagem === "MISTA" && (
                <div className="col-span-2 -mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Paletes descarregadas
                </div>
              )}
              {tipoParagem === "RECOLHA" && (
                <div className="col-span-2 -mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Paletes recolhidas
                </div>
              )}
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

              {linhasExtra.map((l, i) => (
                <div key={i} className="col-span-2 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-2">
                  <div>
                    <label className="label">Tipo de palete</label>
                    <select
                      className="input"
                      value={l.tipoPaleteId}
                      onChange={(e) =>
                        setLinhasExtra((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, tipoPaleteId: e.target.value } : x)),
                        )
                      }
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
                      value={l.nPaletes}
                      onChange={(e) =>
                        setLinhasExtra((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nPaletes: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="col-span-2 text-left text-xs font-medium text-red-600"
                    onClick={() => setLinhasExtra((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕ remover esta palete
                  </button>
                </div>
              ))}
              <div className="col-span-2">
                <button
                  type="button"
                  className="text-sm font-medium text-brand hover:underline"
                  onClick={() => setLinhasExtra((prev) => [...prev, { tipoPaleteId: "", nPaletes: "" }])}
                >
                  + Adicionar palete (outro tamanho, mesmo cliente)
                </button>
              </div>

              {tipoParagem === "MISTA" && (
                <>
                  <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Paletes carregadas
                  </div>
                  {linhasCarregadas.map((l, i) => (
                    <div key={i} className="col-span-2 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-2">
                      <div>
                        <label className="label">Tipo de palete</label>
                        <select
                          className="input"
                          value={l.tipoPaleteId}
                          onChange={(e) =>
                            setLinhasCarregadas((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, tipoPaleteId: e.target.value } : x)),
                            )
                          }
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
                          value={l.nPaletes}
                          onChange={(e) =>
                            setLinhasCarregadas((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, nPaletes: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      {linhasCarregadas.length > 1 && (
                        <button
                          type="button"
                          className="col-span-2 text-left text-xs font-medium text-red-600"
                          onClick={() => setLinhasCarregadas((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ✕ remover esta palete
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="col-span-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-brand hover:underline"
                      onClick={() => setLinhasCarregadas((prev) => [...prev, { tipoPaleteId: "", nPaletes: "" }])}
                    >
                      + Adicionar palete carregada (outro tamanho)
                    </button>
                  </div>
                </>
              )}

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
              {tipoParagem !== "RECOLHA" && (
                <div className={tipoParagem === "MISTA" ? "" : "col-span-2"}>
                  <label className="label">
                    {tipoParagem === "MISTA" ? "Peso aproximado descarregado (kg)" : "Peso aproximado (kg)"} — opcional
                  </label>
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
              )}
              {tipoParagem !== "DESCARGA" && (
                <div className={tipoParagem === "MISTA" ? "" : "col-span-2"}>
                  <label className="label">Peso aproximado recolhido (kg) — opcional</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Só para estimar o consumo de combustível"
                    className="input"
                    value={f.pesoAproximadoCarregado}
                    onChange={(e) => set("pesoAproximadoCarregado", e.target.value as never)}
                  />
                </div>
              )}
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
