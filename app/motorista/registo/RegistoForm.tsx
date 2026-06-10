"use client";

import { useMemo, useState } from "react";
import { TIPOS_VEICULO, TIPOS_VIAGEM } from "@/lib/validacao";
import { fmtEuro } from "@/lib/format";

interface Props {
  zonas: string[];
  capacidadeCamiao: number;
  capacidadeReboque: number;
  valorNoite: number;
  rotasRecentes: string[];
  inicial?: { idRota?: string; tipoVeiculo?: string; kmInicial?: string };
}

const hoje = () => new Date().toISOString().slice(0, 10);

const estadoBase = {
  idRota: "",
  data: hoje(),
  tipoViagem: "Ida",
  tipoVeiculo: "CAMIAO+REBOQUE",
  cliente: "",
  kmInicial: "",
  kmFinal: "",
  kgCarregados: "",
  kgDescarregados: "",
  zonaPortagem: "",
  portagensExtra: "",
  noitesFora: "",
  alimentacao: "",
  horasExtra: "",
  litrosEspanha: "",
  custoEspanha: "",
};

type Campos = typeof estadoBase;

export default function RegistoForm({
  zonas,
  capacidadeCamiao,
  capacidadeReboque,
  valorNoite,
  rotasRecentes,
  inicial,
}: Props) {
  const estadoInicial: Campos = {
    ...estadoBase,
    idRota: inicial?.idRota || "",
    tipoVeiculo: inicial?.tipoVeiculo || estadoBase.tipoVeiculo,
    kmInicial: inicial?.kmInicial || "",
  };

  const [f, setF] = useState<Campos>(estadoInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);

  function set<K extends keyof Campos>(k: K, v: Campos[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
  const peso = Math.max(num(f.kgCarregados), num(f.kgDescarregados));
  const capacidade = f.tipoVeiculo === "CAMIAO+REBOQUE" ? capacidadeReboque : capacidadeCamiao;
  const custoNoites = num(f.noitesFora) * valorNoite;

  // Avisos (não bloqueiam).
  const avisos = useMemo(() => {
    const a: string[] = [];
    if (f.tipoVeiculo !== "LEVE" && f.tipoVeiculo !== "VAZIO" && peso > capacidade) {
      a.push(
        `Peso ${peso.toLocaleString("pt-PT")} kg excede a capacidade do veículo (${capacidade.toLocaleString("pt-PT")} kg).`,
      );
    }
    if (f.zonaPortagem.trim() && !zonas.some((z) => z.toLowerCase() === f.zonaPortagem.trim().toLowerCase())) {
      a.push(`A zona de portagem "${f.zonaPortagem}" não existe na tabela.`);
    }
    return a;
  }, [f.tipoVeiculo, f.zonaPortagem, peso, capacidade, zonas]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!f.idRota.trim()) e.idRota = "Obrigatório";
    if (!f.cliente.trim()) e.cliente = "Obrigatório";
    if (!f.data) e.data = "Obrigatório";
    if (f.kmInicial === "") e.kmInicial = "Obrigatório";
    if (f.kmFinal === "") e.kmFinal = "Obrigatório";
    if (f.kmFinal !== "" && f.kmInicial !== "" && num(f.kmFinal) < num(f.kmInicial)) {
      e.kmFinal = "KM Final deve ser ≥ KM Inicial";
    }
    for (const campo of ["kmInicial", "kmFinal", "kgCarregados", "kgDescarregados"] as const) {
      if (f[campo] !== "" && num(f[campo]) < 0) e[campo] = "Não pode ser negativo";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!validar()) return;
    setAGravar(true);
    try {
      const payload = {
        idRota: f.idRota.trim(),
        data: f.data,
        tipoViagem: f.tipoViagem,
        tipoVeiculo: f.tipoVeiculo,
        cliente: f.cliente.trim(),
        kmInicial: num(f.kmInicial),
        kmFinal: num(f.kmFinal),
        kgCarregados: num(f.kgCarregados),
        kgDescarregados: num(f.kgDescarregados),
        // O combustível usado no cálculo vem dos parâmetros (escritório); o motorista
        // não o introduz. Mantemos só o combustível "por fora" (Espanha), informativo.
        litrosAbastecidos: 0,
        custoAbastecido: 0,
        zonaPortagem: f.zonaPortagem.trim(),
        portagensExtra: num(f.portagensExtra),
        noitesFora: num(f.noitesFora),
        alimentacao: num(f.alimentacao),
        horasExtra: num(f.horasExtra),
        receitaPaga: 0,
        litrosEspanha: f.litrosEspanha === "" ? null : num(f.litrosEspanha),
        custoEspanha: f.custoEspanha === "" ? null : num(f.custoEspanha),
      };
      const res = await fetch("/api/paragens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: data.erro || "Erro ao gravar." });
        return;
      }
      setMsg({ tipo: "ok", texto: "Paragem registada! Pode adicionar outra na mesma rota." });
      // Mantém ID Rota, tipo veículo e KM Final -> KM Inicial para a próxima paragem.
      setF({
        ...estadoBase,
        idRota: f.idRota,
        data: f.data,
        tipoVeiculo: f.tipoVeiculo,
        kmInicial: f.kmFinal,
      });
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de ligação." });
    } finally {
      setAGravar(false);
    }
  }

  const campoNum = (
    k: keyof Campos,
    label: string,
    extra?: { step?: string; placeholder?: string },
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={extra?.step ?? "any"}
        placeholder={extra?.placeholder}
        className="input"
        value={f[k]}
        onChange={(e) => set(k, e.target.value as Campos[keyof Campos])}
      />
      {erros[k] && <p className="mt-1 text-xs text-red-600">{erros[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submeter} className="space-y-4 pb-10">
      {msg && (
        <div
          className={`rounded-lg p-3 text-sm ${
            msg.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.texto}
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <label className="label">ID Rota</label>
          <input
            list="rotas"
            className="input"
            value={f.idRota}
            onChange={(e) => set("idRota", e.target.value)}
            placeholder="ex.: BOTO, GA1"
          />
          <datalist id="rotas">
            {rotasRecentes.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          {erros.idRota && <p className="mt-1 text-xs text-red-600">{erros.idRota}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              className="input"
              value={f.data}
              onChange={(e) => set("data", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Tipo Viagem</label>
            <select
              className="input"
              value={f.tipoViagem}
              onChange={(e) => set("tipoViagem", e.target.value)}
            >
              {TIPOS_VIAGEM.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Tipo Veículo</label>
          <select
            className="input"
            value={f.tipoVeiculo}
            onChange={(e) => set("tipoVeiculo", e.target.value)}
          >
            {TIPOS_VEICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Cliente / Local</label>
          <input
            className="input"
            value={f.cliente}
            onChange={(e) => set("cliente", e.target.value)}
          />
          {erros.cliente && <p className="mt-1 text-xs text-red-600">{erros.cliente}</p>}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-3">
        {campoNum("kmInicial", "KM Inicial")}
        {campoNum("kmFinal", "KM Final")}
        {campoNum("kgCarregados", "KG Carregados")}
        {campoNum("kgDescarregados", "KG Descarregados")}
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Zona Portagem</label>
          <input
            list="zonas"
            className="input"
            value={f.zonaPortagem}
            onChange={(e) => set("zonaPortagem", e.target.value)}
          />
          <datalist id="zonas">
            {zonas.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {campoNum("portagensExtra", "Portagens Extra (€)")}
          {campoNum("alimentacao", "Alimentação (€)")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Noites fora (nº)</label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              className="input"
              value={f.noitesFora}
              onChange={(e) => set("noitesFora", e.target.value)}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              {num(f.noitesFora) > 0
                ? `${num(f.noitesFora)} × ${fmtEuro(valorNoite)} = ${fmtEuro(custoNoites)}`
                : `Valor por noite: ${fmtEuro(valorNoite)}`}
            </p>
          </div>
          {campoNum("horasExtra", "Horas Extra")}
        </div>
      </div>

      <div className="card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Combustível por fora (Espanha) — informativo, poupança
        </p>
        <div className="grid grid-cols-2 gap-3">
          {campoNum("litrosEspanha", "Litros Espanha")}
          {campoNum("custoEspanha", "Custo Espanha (€)")}
        </div>
      </div>

      {avisos.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {avisos.map((a, i) => (
            <p key={i}>⚠️ {a}</p>
          ))}
        </div>
      )}

      <button type="submit" disabled={aGravar} className="btn w-full">
        {aGravar ? "A gravar…" : "Registar paragem"}
      </button>
    </form>
  );
}
