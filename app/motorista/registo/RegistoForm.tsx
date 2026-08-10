"use client";

import { useMemo, useState } from "react";
import { ROTULOS_TIPO_VEICULO, TIPOS_VEICULO, TIPOS_VIAGEM } from "@/lib/validacao";
import { fmtEuro } from "@/lib/format";

export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  dataLimiteInspecao: string | null;
  inspecaoVerificada: boolean;
}

// 45 dias (mês e meio) antes do prazo, o motorista começa a ver o aviso.
const DIAS_AVISO_INSPECAO = 45;

const TIPOS_PALETE = ["PALETE_120X80", "PALETE_120X100"] as const;

interface Props {
  zonas: string[];
  veiculos: VeiculoOpcao[];
  capacidadeCamiao: number;
  capacidadeReboque: number;
  capacidadePaleteA: number;
  capacidadePaleteB: number;
  valorNoite: number;
  rotasRecentes: string[];
  clientes: string[];
  inicial?: { idRota?: string; tipoVeiculo?: string; kmInicial?: string };
  paragensRotaIniciais: ParagemRotaResumo[];
}

interface ParagemRotaResumo {
  cliente: string;
  zonaPortagem: string;
  portagensExtra: number;
  noitesFora: number;
  alimentacao: number;
}

// "12 €, 8 € e 5 €" — junta com vírgula e liga o último item com "e".
function listarComE(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const hoje = () => new Date().toISOString().slice(0, 10);

const estadoBase = {
  data: hoje(),
  tipoViagem: "Ida",
  tipoVeiculo: "CAMIAO+REBOQUE",
  veiculoId: "",
  cliente: "",
  kmInicial: "",
  kmFinal: "",
  kgCarregados: "",
  kgDescarregados: "",
  nPaletes: "",
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
  veiculos,
  capacidadeCamiao,
  capacidadeReboque,
  capacidadePaleteA,
  capacidadePaleteB,
  valorNoite,
  rotasRecentes,
  clientes,
  inicial,
  paragensRotaIniciais,
}: Props) {
  const estadoInicial: Campos = {
    ...estadoBase,
    tipoVeiculo: inicial?.tipoVeiculo || estadoBase.tipoVeiculo,
    veiculoId: veiculos.length === 1 ? String(veiculos[0].id) : "",
    kmInicial: inicial?.kmInicial || "",
  };

  const [f, setF] = useState<Campos>(estadoInicial);
  // "" = rota nova (ID gerado pelo servidor); preenchido = continuar essa rota.
  const [idRotaAtiva, setIdRotaAtiva] = useState(inicial?.idRota || "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  // Secções opcionais começam encolhidas (só um botão) para o motorista
  // chegar mais depressa a "Registar paragem" — expandem só se precisar.
  const [mostrarEspanha, setMostrarEspanha] = useState(false);
  // Recolha cujo material vai ser entregue a outro cliente mais tarde na
  // mesma rota — só assinala; quem vai ser faturado fica para o escritório
  // atribuir depois (ParagemEditor).
  const [recolha, setRecolha] = useState(false);
  // Paragens já submetidas nesta rota (para mostrar o que já foi introduzido
  // e evitar duplicar noites/alimentação ao longo de várias paragens).
  const [paragensRota, setParagensRota] = useState<ParagemRotaResumo[]>(paragensRotaIniciais);

  const noitesJaRegistadas = useMemo(
    () => paragensRota.reduce((soma, p) => soma + p.noitesFora, 0),
    [paragensRota],
  );
  const alimentacaoJaRegistada = useMemo(
    () => paragensRota.map((p) => p.alimentacao).filter((v) => v > 0),
    [paragensRota],
  );
  const zonasJaUsadas = useMemo(
    () => Array.from(new Set(paragensRota.map((p) => p.zonaPortagem).filter(Boolean))),
    [paragensRota],
  );
  const portagensJaRegistadas = useMemo(
    () => paragensRota.map((p) => p.portagensExtra).filter((v) => v > 0),
    [paragensRota],
  );

  function set<K extends keyof Campos>(k: K, v: Campos[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
  const peso = Math.max(num(f.kgCarregados), num(f.kgDescarregados));
  const veiculoSel = veiculos.find((v) => String(v.id) === f.veiculoId);
  const capCamiao = veiculoSel?.capacidadeCamiao ?? capacidadeCamiao;
  const capReboque = veiculoSel?.capacidadeReboque ?? capacidadeReboque;
  const capPaleteA = veiculoSel?.capacidadePaleteA ?? capacidadePaleteA;
  const capPaleteB = veiculoSel?.capacidadePaleteB ?? capacidadePaleteB;
  const capacidade = f.tipoVeiculo === "CAMIAO+REBOQUE" ? capReboque : capCamiao;
  const ehPaleteA = f.tipoVeiculo === "PALETE_120X80";
  const ehPaleteB = f.tipoVeiculo === "PALETE_120X100";
  const ehPalete = ehPaleteA || ehPaleteB;
  const capacidadePaletes = ehPaleteA ? capPaleteA : capPaleteB;
  const custoNoites = num(f.noitesFora) * valorNoite;

  // Paletes: o peso não entra (ocupação é por nº de paletes, combustível
  // tratado sempre como vazio) — trocar de/para um tipo de palete limpa os
  // campos que deixam de fazer sentido.
  // VAZIO: não há cliente a faturar (repositionamento), preenche "Vazio"
  // automaticamente para o motorista não ter de escrever nada; ao sair de
  // VAZIO, limpa esse valor para escrever o cliente real.
  function setTipoVeiculo(v: string) {
    const eDePalete = (TIPOS_PALETE as readonly string[]).includes(v);
    setF((prev) => ({
      ...prev,
      tipoVeiculo: v,
      nPaletes: eDePalete ? prev.nPaletes : "",
      kgCarregados: eDePalete ? "" : prev.kgCarregados,
      kgDescarregados: eDePalete ? "" : prev.kgDescarregados,
      cliente:
        v === "VAZIO" ? "Vazio" : prev.tipoVeiculo === "VAZIO" && prev.cliente === "Vazio" ? "" : prev.cliente,
    }));
  }

  // Avisos (não bloqueiam).
  const avisos = useMemo(() => {
    const a: string[] = [];
    if (ehPalete) {
      const nPal = num(f.nPaletes);
      if (nPal > capacidadePaletes) {
        a.push(
          `${nPal} paletes excede a capacidade do veículo (${capacidadePaletes} paletes).`,
        );
      }
    } else if (f.tipoVeiculo !== "VAZIO" && peso > capacidade) {
      a.push(
        `Peso ${peso.toLocaleString("pt-PT")} kg excede a capacidade do veículo (${capacidade.toLocaleString("pt-PT")} kg).`,
      );
    }
    if (f.zonaPortagem.trim() && !zonas.some((z) => z.toLowerCase() === f.zonaPortagem.trim().toLowerCase())) {
      a.push(`A zona de portagem "${f.zonaPortagem}" não existe na tabela.`);
    }
    if (veiculoSel?.dataLimiteInspecao && !veiculoSel.inspecaoVerificada) {
      const prazo = new Date(veiculoSel.dataLimiteInspecao);
      const avisoDesde = new Date(prazo);
      avisoDesde.setDate(avisoDesde.getDate() - DIAS_AVISO_INSPECAO);
      const hojeDate = new Date(hoje());
      if (hojeDate >= avisoDesde) {
        const prazoFmt = prazo.toLocaleDateString("pt-PT");
        a.push(
          hojeDate > prazo
            ? `Este veículo já devia ter ido à inspeção (prazo era ${prazoFmt}).`
            : `Este veículo tem de ir à inspeção até ${prazoFmt}.`,
        );
      }
    }
    return a;
  }, [f.tipoVeiculo, f.zonaPortagem, f.nPaletes, peso, capacidade, capacidadePaletes, ehPalete, zonas, veiculoSel]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (veiculos.length > 0 && !f.veiculoId) e.veiculoId = "Escolha o veículo";
    if (!f.cliente.trim()) e.cliente = "Obrigatório";
    if (!f.data) e.data = "Obrigatório";
    if (f.kmInicial === "") e.kmInicial = "Obrigatório";
    if (f.kmFinal === "") e.kmFinal = "Obrigatório";
    if (f.kmFinal !== "" && f.kmInicial !== "" && num(f.kmFinal) < num(f.kmInicial)) {
      e.kmFinal = "KM Final deve ser ≥ KM Inicial";
    }
    for (const campo of ["kmInicial", "kmFinal", "kgCarregados", "kgDescarregados", "nPaletes"] as const) {
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
        // Vazio => rota nova (o servidor gera o ID); preenchido => continuar a rota ativa.
        idRota: idRotaAtiva || undefined,
        data: f.data,
        tipoViagem: f.tipoViagem,
        tipoVeiculo: f.tipoVeiculo,
        veiculoId: f.veiculoId ? Number(f.veiculoId) : null,
        cliente: f.cliente.trim(),
        kmInicial: num(f.kmInicial),
        kmFinal: num(f.kmFinal),
        kgCarregados: num(f.kgCarregados),
        kgDescarregados: num(f.kgDescarregados),
        nPaletes: num(f.nPaletes),
        // O combustível usado no cálculo vem dos parâmetros (escritório); o motorista
        // não o introduz. Mantemos só o combustível "por fora" (Espanha), informativo.
        litrosAbastecidos: 0,
        custoAbastecido: 0,
        zonaPortagem: f.zonaPortagem.trim(),
        portagensExtra: num(f.portagensExtra),
        noitesFora: num(f.noitesFora),
        alimentacao: num(f.alimentacao),
        horasExtra: num(f.horasExtra),
        recolha,
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
      // O servidor devolve o idRota efetivo (gerado quando era rota nova).
      const novoId = data.paragem?.idRota as string | undefined;
      const eraNova = !idRotaAtiva;
      if (novoId) setIdRotaAtiva(novoId);
      setParagensRota((prev) => [
        ...prev,
        {
          cliente: payload.cliente,
          zonaPortagem: payload.zonaPortagem,
          portagensExtra: payload.portagensExtra,
          noitesFora: payload.noitesFora,
          alimentacao: payload.alimentacao,
        },
      ]);
      setMsg({
        tipo: "ok",
        texto:
          eraNova && novoId
            ? `Rota ${novoId} criada — pode adicionar mais paragens.`
            : "Paragem registada! Pode adicionar outra na mesma rota.",
      });
      // Mantém a rota ativa, tipo veículo e KM Final -> KM Inicial para a próxima paragem.
      setF({
        ...estadoBase,
        data: f.data,
        tipoVeiculo: f.tipoVeiculo,
        veiculoId: f.veiculoId,
        kmInicial: f.kmFinal,
        cliente: f.tipoVeiculo === "VAZIO" ? "Vazio" : estadoBase.cliente,
      });
      setMostrarEspanha(false);
      setRecolha(false);
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
        {idRotaAtiva ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 p-3">
            <div>
              <span className="label">Rota ativa</span>
              <p className="font-semibold text-blue-900">{idRotaAtiva}</p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-blue-700 underline"
              onClick={() => {
                setIdRotaAtiva("");
                setParagensRota([]);
              }}
            >
              Nova rota
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <span className="label">Nova rota</span>
              <p className="text-xs text-gray-500">
                O ID é gerado automaticamente a partir do seu nome e do cliente.
              </p>
            </div>
            {rotasRecentes.length > 0 && (
              <div>
                <label className="label">Ou continuar uma rota recente</label>
                <select
                  className="input"
                  value=""
                  onChange={(e) => e.target.value && setIdRotaAtiva(e.target.value)}
                >
                  <option value="">— escolher rota —</option>
                  {rotasRecentes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo Veículo</label>
            <select
              className="input"
              value={f.tipoVeiculo}
              onChange={(e) => setTipoVeiculo(e.target.value)}
            >
              {TIPOS_VEICULO.map((t) => (
                <option key={t} value={t}>
                  {ROTULOS_TIPO_VEICULO[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Veículo (camião)</label>
            <select
              className="input"
              value={f.veiculoId}
              onChange={(e) => set("veiculoId", e.target.value)}
              disabled={veiculos.length === 0}
            >
              <option value="">{veiculos.length === 0 ? "Sem veículos" : "— escolher —"}</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                  {v.matricula ? ` (${v.matricula})` : ""}
                </option>
              ))}
            </select>
            {erros.veiculoId && <p className="mt-1 text-xs text-red-600">{erros.veiculoId}</p>}
          </div>
        </div>

        {f.tipoVeiculo === "VAZIO" ? (
          <div>
            <label className="label">Cliente / Local</label>
            <p className="input flex items-center bg-gray-50 text-gray-500">
              Vazio — sem cliente a faturar
            </p>
          </div>
        ) : (
          <div>
            <label className="label">Cliente / Local</label>
            <input
              list="clientes"
              className="input"
              value={f.cliente}
              onChange={(e) => set("cliente", e.target.value)}
            />
            <datalist id="clientes">
              {clientes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {erros.cliente && <p className="mt-1 text-xs text-red-600">{erros.cliente}</p>}
          </div>
        )}
      </div>

      <div className="card grid grid-cols-2 gap-3">
        {campoNum("kmInicial", "KM Inicial")}
        {campoNum("kmFinal", "KM Final")}
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={recolha} onChange={(e) => setRecolha(e.target.checked)} />
            Recolha
          </label>
        </div>
        {ehPalete ? (
          <div>
            <label className="label">Nº de paletes</label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              className="input"
              value={f.nPaletes}
              onChange={(e) => set("nPaletes", e.target.value)}
            />
          </div>
        ) : (
          <>
            {campoNum("kgCarregados", "KG Carregados")}
            {campoNum("kgDescarregados", "KG Descarregados")}
          </>
        )}
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
          {zonasJaUsadas.length > 0 && (
            <p className="mt-1 text-xs text-blue-600">
              Já {zonasJaUsadas.length === 1 ? "foi usada" : "foram usadas"}: {listarComE(zonasJaUsadas)} nesta
              rota.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Portagens Extra (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              className="input"
              value={f.portagensExtra}
              onChange={(e) => set("portagensExtra", e.target.value)}
            />
            {erros.portagensExtra && <p className="mt-1 text-xs text-red-600">{erros.portagensExtra}</p>}
            {portagensJaRegistadas.length > 0 && (
              <p className="mt-1 text-xs text-blue-600">
                Já foram introduzidos: {listarComE(portagensJaRegistadas.map(fmtEuro))} nesta rota.
              </p>
            )}
          </div>
          {campoNum("horasExtra", "Horas Extra")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Noites fora (nº)</label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              className="input max-w-[110px]"
              value={f.noitesFora}
              onChange={(e) => set("noitesFora", e.target.value)}
              placeholder="0"
            />
            {noitesJaRegistadas > 0 && (
              <p className="mt-1 text-xs text-blue-600">
                Já {noitesJaRegistadas === 1 ? "foi introduzida 1 noite" : `foram introduzidas ${noitesJaRegistadas} noites`}{" "}
                nesta rota.
              </p>
            )}
          </div>
          <div>
            <label className="label">Alimentação (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              className="input max-w-[110px]"
              value={f.alimentacao}
              onChange={(e) => set("alimentacao", e.target.value)}
            />
            {erros.alimentacao && <p className="mt-1 text-xs text-red-600">{erros.alimentacao}</p>}
            {alimentacaoJaRegistada.length > 0 && (
              <p className="mt-1 text-xs text-blue-600">
                Já foram introduzidos: {listarComE(alimentacaoJaRegistada.map(fmtEuro))} nesta rota.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={mostrarEspanha}
            onChange={(e) => {
              const marcado = e.target.checked;
              setMostrarEspanha(marcado);
              if (!marcado) setF((prev) => ({ ...prev, litrosEspanha: "", custoEspanha: "" }));
            }}
          />
          Abasteci em Espanha
        </label>
        {mostrarEspanha && (
          <div className="grid grid-cols-2 gap-3">
            {campoNum("litrosEspanha", "Litros Espanha")}
            {campoNum("custoEspanha", "Custo Espanha (€)")}
          </div>
        )}
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
