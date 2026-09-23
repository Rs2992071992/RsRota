"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_VEICULO, TIPOS_VIAGEM } from "@/lib/validacao";
import { verificarEspacoCarga, type ParagemCarga } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";
import { fmtEuro } from "@/lib/format";
import Autocomplete from "@/components/Autocomplete";

export interface VeiculoOpcao {
  id: number;
  nome: string;
  matricula: string | null;
  // Caixa de carga (mm) — "só camião"; + a do reboque habitual, se ligado
  // (ver Veiculo.reboqueHabitual). null = veículo ainda sem estas medidas
  // configuradas em /escritorio/veiculos.
  caixaComprimentoMm: number | null;
  caixaLarguraMm: number | null;
  caixaReboqueComprimentoMm: number | null;
  caixaReboqueLarguraMm: number | null;
  fatorOcupacaoPalete: number;
  dataLimiteInspecao: string | null;
  inspecaoVerificada: boolean;
}

/** Tipo de palete do catálogo (dimensões reais, mm) — ver /escritorio/cargas. */
export interface TipoPaleteOpcao {
  id: number;
  nome: string;
  comprimentoMm: number;
  larguraMm: number;
}

// 45 dias (mês e meio) antes do prazo, o motorista começa a ver o aviso.
const DIAS_AVISO_INSPECAO = 45;

/** Uma linha de palete resolvida (dimensões do catálogo), para a simulação
 * de espaço ao vivo. */
interface LinhaSimples {
  tipoPaleteId: number;
  comprimentoMm: number;
  larguraMm: number;
  nPaletes: number;
  clienteNome?: string;
}

interface Props {
  zonas: string[];
  veiculos: VeiculoOpcao[];
  tiposPalete: TipoPaleteOpcao[];
  /** Campos opcionais deste motorista (desligáveis em /escritorio/motoristas/[id]). */
  mostraNoitesFora: boolean;
  mostraAlimentacao: boolean;
  mostraHorasExtra: boolean;
  valorNoite: number;
  /** Última paragem conhecida de cada rota recente — para "continuar rota"
   * pré-preencher KM Inicial/Tipo Veículo sem depender de outra query. */
  rotasRecentes: { idRota: string; tipoVeiculo: string; kmFinal: number }[];
  clientes: string[];
  inicial?: { idRota?: string; tipoVeiculo?: string; kmInicial?: string };
  paragensRotaIniciais: ParagemRotaResumo[];
}

interface ParagemRotaResumo {
  cliente: string;
  /** Recolha para entregar a outro cliente — ver ParagemCarga.faturarCliente. */
  faturarCliente?: string | null;
  zonaPortagem: string;
  portagensExtra: number;
  noitesFora: number;
  alimentacao: number;
  /** Paletes descarregadas nesta paragem (vinham a bordo desde o início). */
  entregues: { comprimentoMm: number; larguraMm: number; nPaletes: number }[];
  /** Paletes carregadas nesta paragem (entram aqui, ficam a bordo). */
  recolhidas: { comprimentoMm: number; larguraMm: number; nPaletes: number }[];
  tipoVeiculo: string;
  kmInicial: number;
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
  tipoPaleteId: "",
  nPaletes: "",
  nMeiasPaletes: "",
  pesoAproximado: "",
  pesoAproximadoCarregado: "",
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
  tiposPalete,
  mostraNoitesFora,
  mostraAlimentacao,
  mostraHorasExtra,
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

  const router = useRouter();
  const [f, setF] = useState<Campos>(estadoInicial);
  // "" = rota nova (ID gerado pelo servidor); preenchido = continuar essa rota.
  const [idRotaAtiva, setIdRotaAtiva] = useState(inicial?.idRota || "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  // Secções opcionais começam encolhidas (só um botão) para o motorista
  // chegar mais depressa a "Registar paragem" — expandem só se precisar.
  const [mostrarEspanha, setMostrarEspanha] = useState(false);
  // Descarga (defeito) / Recolha / Descarga+Recolha. Substitui o antigo
  // checkbox único "Recolha". Numa Recolha "pura", o material pode ser
  // entregue a outro cliente mais tarde na mesma rota — só assinala; quem vai
  // ser faturado fica para o escritório atribuir depois (ParagemEditor).
  const [tipoParagem, setTipoParagem] = useState<"DESCARGA" | "RECOLHA" | "MISTA">("DESCARGA");
  const recolha = tipoParagem !== "DESCARGA";
  // Linhas de palete ADICIONAIS descarregadas (a 1.ª é f.tipoPaleteId/f.nPaletes;
  // em RECOLHA pura, este é o bloco único — o que foi apanhado). Para o mesmo
  // cliente na mesma descarga com paletes de tamanhos diferentes.
  const [linhasExtra, setLinhasExtra] = useState<{ tipoPaleteId: string; nPaletes: string }[]>([]);
  // Linhas de palete CARREGADAS — só usadas em "Descarga + Recolha".
  const [linhasCarregadas, setLinhasCarregadas] = useState<{ tipoPaleteId: string; nPaletes: string }[]>([
    { tipoPaleteId: "", nPaletes: "" },
  ]);
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
  const veiculoSel = veiculos.find((v) => String(v.id) === f.veiculoId);
  const mostrarPaletes = f.tipoVeiculo !== "VAZIO";
  const tipoPaleteSel = tiposPalete.find((t) => String(t.id) === f.tipoPaleteId);
  // Todas as linhas de palete desta paragem: a 1.ª (f) + as adicionais.
  const linhasPaleteForm = [
    { tipoPaleteId: f.tipoPaleteId, nPaletes: f.nPaletes },
    ...linhasExtra,
  ];
  // Linhas com tipo + nº válidos, já com as dimensões do catálogo resolvidas.
  // Em DESCARGA/MISTA são as descarregadas; em RECOLHA pura, o único bloco
  // (o que foi apanhado).
  const linhasPaleteResolvidas = linhasPaleteForm
    .map((l) => ({ tipo: tiposPalete.find((t) => String(t.id) === l.tipoPaleteId), n: num(l.nPaletes) }))
    .filter((l): l is { tipo: TipoPaleteOpcao; n: number } => !!l.tipo && l.n > 0);
  const totalPaletesForm = linhasPaleteResolvidas.reduce((s, l) => s + l.n, 0);
  const temLinhasExtra = linhasExtra.length > 0;
  // Linhas carregadas — só relevantes em MISTA.
  const linhasCarregadasResolvidas = linhasCarregadas
    .map((l) => ({ tipo: tiposPalete.find((t) => String(t.id) === l.tipoPaleteId), n: num(l.nPaletes) }))
    .filter((l): l is { tipo: TipoPaleteOpcao; n: number } => !!l.tipo && l.n > 0);
  const totalCarregadasForm = linhasCarregadasResolvidas.reduce((s, l) => s + l.n, 0);

  /** Linhas desta paragem separadas por sentido — usadas na simulação de
   * espaço (memo abaixo) e no resumo guardado após o registo. */
  function linhasParagemForm(): { entregues: LinhaSimples[]; recolhidas: LinhaSimples[] } {
    const nome = f.cliente.trim() || "esta paragem";
    const paraLinha = (l: { tipo: TipoPaleteOpcao; n: number }): LinhaSimples => ({
      tipoPaleteId: l.tipo.id,
      comprimentoMm: l.tipo.comprimentoMm,
      larguraMm: l.tipo.larguraMm,
      nPaletes: l.n,
      clienteNome: nome,
    });
    const base = linhasPaleteResolvidas.map(paraLinha);
    const carregadas = linhasCarregadasResolvidas.map(paraLinha);
    const entregues = tipoParagem === "RECOLHA" ? [] : base;
    const recolhidas = tipoParagem === "DESCARGA" ? [] : tipoParagem === "RECOLHA" ? base : carregadas;

    // Meias-paletes sem base por baixo -> chão, 2 por lugar; seguem o mesmo
    // sentido da paragem (recolha => recolhidas, senão entregues — igual ao
    // fallback do servidor em linhasCargaParagem).
    const dimRef =
      entregues[0] ??
      recolhidas[0] ??
      (tipoPaleteSel
        ? { tipoPaleteId: tipoPaleteSel.id, comprimentoMm: tipoPaleteSel.comprimentoMm, larguraMm: tipoPaleteSel.larguraMm, nPaletes: 0, clienteNome: nome }
        : null);
    const totalBase = totalPaletesForm + totalCarregadasForm;
    const noChao = Math.max(0, Math.floor(num(f.nMeiasPaletes)) - totalBase);
    const slots = Math.ceil(noChao / 2);
    if (slots > 0 && dimRef) {
      (recolha ? recolhidas : entregues).push({ ...dimRef, nPaletes: slots });
    }
    return { entregues, recolhidas };
  }

  // Sobreocupação de espaço: soma TODAS as paletes já registadas na rota + a
  // paragem que está a ser escrita e arruma-as com o motor de empacotamento 2D
  // real (o mesmo das Cargas do escritório). null = sem veículo escolhido.
  const espacoCargaRota = useMemo(() => {
    if (!veiculoSel) return null;
    const caixasBase: CaixaInput[] = [];
    if (veiculoSel.caixaComprimentoMm && veiculoSel.caixaLarguraMm) {
      caixasBase.push({
        id: "veiculo",
        label: veiculoSel.nome,
        comprimentoMm: veiculoSel.caixaComprimentoMm,
        larguraMm: veiculoSel.caixaLarguraMm,
      });
    }
    // A caixa do reboque entra sempre que o veículo a tiver configurada — é o
    // motor (`verificarEspacoCarga`) que decide, momento a momento, se se
    // aplica com base no `tipoVeiculo` de cada paragem (a atual e as já
    // registadas em `paragensRota`), não com o `tipoVeiculo` só desta
    // paragem: um reboque largado a meio da rota deixa de contar a partir daí.
    const caixaReboque: CaixaInput | null =
      veiculoSel.caixaReboqueComprimentoMm && veiculoSel.caixaReboqueLarguraMm
        ? { id: "reboque", label: "Reboque", comprimentoMm: veiculoSel.caixaReboqueComprimentoMm, larguraMm: veiculoSel.caixaReboqueLarguraMm }
        : null;
    const linhaCarga = (l: { comprimentoMm: number; larguraMm: number; nPaletes: number }, clienteNome?: string) => ({
      tipoPaleteId: 0,
      comprimentoMm: l.comprimentoMm,
      larguraMm: l.larguraMm,
      nPaletes: l.nPaletes,
      clienteNome,
    });
    const paragensCarga: ParagemCarga[] = paragensRota.map((p) => ({
      entregues: p.entregues.filter((l) => l.nPaletes > 0 && l.comprimentoMm && l.larguraMm).map((l) => linhaCarga(l, p.cliente)),
      recolhidas: p.recolhidas.filter((l) => l.nPaletes > 0 && l.comprimentoMm && l.larguraMm).map((l) => linhaCarga(l, p.cliente)),
      tipoVeiculo: p.tipoVeiculo,
      kmInicial: p.kmInicial,
      cliente: p.cliente,
      faturarCliente: p.faturarCliente,
    }));
    if (mostrarPaletes) {
      const { entregues, recolhidas } = linhasParagemForm();
      paragensCarga.push({ entregues, recolhidas, tipoVeiculo: f.tipoVeiculo, kmInicial: num(f.kmInicial) });
    }
    return verificarEspacoCarga(caixasBase, caixaReboque, paragensCarga);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    veiculoSel,
    paragensRota,
    mostrarPaletes,
    tipoParagem,
    recolha,
    f.tipoVeiculo,
    f.kmInicial,
    f.tipoPaleteId,
    f.nMeiasPaletes,
    totalPaletesForm,
    totalCarregadasForm,
    JSON.stringify(linhasPaleteResolvidas),
    JSON.stringify(linhasCarregadasResolvidas),
    f.cliente,
  ]);
  const custoNoites = num(f.noitesFora) * valorNoite;

  // VAZIO: não há cliente a faturar (repositionamento) nem carga a bordo,
  // preenche "Vazio" automaticamente para o motorista não ter de escrever
  // nada; ao sair de VAZIO, limpa esse valor para escrever o cliente real.
  function setTipoVeiculo(v: string) {
    if (v === "VAZIO") {
      setLinhasExtra([]);
      setLinhasCarregadas([{ tipoPaleteId: "", nPaletes: "" }]);
      setTipoParagem("DESCARGA");
    }
    setF((prev) => ({
      ...prev,
      tipoVeiculo: v,
      tipoPaleteId: v === "VAZIO" ? "" : prev.tipoPaleteId,
      nPaletes: v === "VAZIO" ? "" : prev.nPaletes,
      nMeiasPaletes: v === "VAZIO" ? "" : prev.nMeiasPaletes,
      pesoAproximado: v === "VAZIO" ? "" : prev.pesoAproximado,
      pesoAproximadoCarregado: v === "VAZIO" ? "" : prev.pesoAproximadoCarregado,
      cliente:
        v === "VAZIO" ? "Vazio" : prev.tipoVeiculo === "VAZIO" && prev.cliente === "Vazio" ? "" : prev.cliente,
    }));
  }

  // Avisos (não bloqueiam).
  const avisos = useMemo(() => {
    const a: string[] = [];
    // Meias-paletes que cabem em cima das bases não ocupam chão; as que sobram
    // contam a 2 por lugar (ver linhasCargaParagem).
    if (mostrarPaletes && espacoCargaRota?.verificavel && !espacoCargaRota.cabemTodas) {
      a.push(
        `As paletes desta rota já não cabem no veículo: cabem ~${espacoCargaRota.colocadas} de ${espacoCargaRota.totalPaletes} (${espacoCargaRota.semEspaco} sem espaço).`,
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
  }, [f.zonaPortagem, espacoCargaRota, mostrarPaletes, zonas, veiculoSel]);

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
    for (const campo of [
      "kmInicial",
      "kmFinal",
      "nPaletes",
      "nMeiasPaletes",
      "pesoAproximado",
      "pesoAproximadoCarregado",
    ] as const) {
      if (f[campo] !== "" && num(f[campo]) < 0) e[campo] = "Não pode ser negativo";
    }
    if (mostrarPaletes) {
      if (tipoParagem === "MISTA") {
        // Descarregadas e carregadas são cada uma opcional isoladamente — só é
        // preciso ter algo num dos dois lados (ou meias-paletes).
        if (f.tipoPaleteId && num(f.nPaletes) <= 0) e.nPaletes = "Indique o nº de paletes";
        if (!f.tipoPaleteId && num(f.nPaletes) > 0) e.tipoPaleteId = "Escolha o tipo de palete";
        linhasExtra.forEach((l, i) => {
          if (!l.tipoPaleteId) e[`linhaExtra${i}Tipo`] = "Escolha o tipo de palete";
          if (!l.nPaletes || num(l.nPaletes) <= 0) e[`linhaExtra${i}N`] = "Indique o nº de paletes";
        });
        linhasCarregadas.forEach((l, i) => {
          if (!l.tipoPaleteId && !l.nPaletes) return; // linha vazia, por preencher — ignora
          if (!l.tipoPaleteId) e[`linhaCarregada${i}Tipo`] = "Escolha o tipo de palete";
          if (!l.nPaletes || num(l.nPaletes) <= 0) e[`linhaCarregada${i}N`] = "Indique o nº de paletes";
        });
        const temAlgo =
          num(f.nPaletes) > 0 || num(f.nMeiasPaletes) > 0 || linhasCarregadas.some((l) => num(l.nPaletes) > 0);
        if (!temAlgo) e.nPaletes = "Indique paletes descarregadas ou carregadas";
      } else {
        if (!f.tipoPaleteId) e.tipoPaleteId = "Escolha o tipo de palete";
        // Basta paletes inteiras OU meias-paletes (uma meia sozinha é válida).
        if (num(f.nPaletes) <= 0 && num(f.nMeiasPaletes) <= 0) {
          e.nPaletes = "Indique o nº de paletes ou de meias-paletes";
        }
        linhasExtra.forEach((l, i) => {
          if (!l.tipoPaleteId) e[`linhaExtra${i}Tipo`] = "Escolha o tipo de palete";
          if (!l.nPaletes || num(l.nPaletes) <= 0) e[`linhaExtra${i}N`] = "Indique o nº de paletes";
        });
      }
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
        tipoPaleteId: mostrarPaletes && f.tipoPaleteId ? Number(f.tipoPaleteId) : null,
        nPaletes: mostrarPaletes ? num(f.nPaletes) : 0,
        // MISTA envia sempre `paletes` (descarregadas + carregadas, com
        // sentido); fora disso só quando há mais do que uma linha — 1 linha
        // usa os campos escalares acima, exatamente como sempre.
        paletes: !mostrarPaletes
          ? undefined
          : tipoParagem === "MISTA"
            ? [
                ...linhasPaleteResolvidas.map((l) => ({ tipoPaleteId: l.tipo.id, nPaletes: l.n, sentido: "ENTREGA" as const })),
                ...linhasCarregadasResolvidas.map((l) => ({ tipoPaleteId: l.tipo.id, nPaletes: l.n, sentido: "RECOLHA" as const })),
              ]
            : temLinhasExtra
              ? linhasPaleteResolvidas.map((l) => ({ tipoPaleteId: l.tipo.id, nPaletes: l.n }))
              : undefined,
        nMeiasPaletes: mostrarPaletes ? num(f.nMeiasPaletes) : 0,
        // Descarregado só faz sentido em DESCARGA/MISTA; recolhido só em RECOLHA/MISTA.
        pesoAproximado:
          tipoParagem === "RECOLHA" || f.pesoAproximado === "" ? null : num(f.pesoAproximado),
        pesoAproximadoCarregado:
          tipoParagem === "DESCARGA" || f.pesoAproximadoCarregado === ""
            ? null
            : num(f.pesoAproximadoCarregado),
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
          ...(() => {
            const { entregues, recolhidas } = linhasParagemForm();
            const semTipo = (ls: LinhaSimples[]) => ls.map(({ comprimentoMm, larguraMm, nPaletes }) => ({ comprimentoMm, larguraMm, nPaletes }));
            return { entregues: semTipo(entregues), recolhidas: semTipo(recolhidas) };
          })(),
          tipoVeiculo: payload.tipoVeiculo,
          kmInicial: payload.kmInicial,
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
      setTipoParagem("DESCARGA");
      setLinhasExtra([]);
      setLinhasCarregadas([{ tipoPaleteId: "", nPaletes: "" }]);
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
        onChange={(e) => set(k, e.target.value)}
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
                  onChange={(e) => {
                    const r = rotasRecentes.find((x) => x.idRota === e.target.value);
                    if (!r) return;
                    // Navega com os mesmos parâmetros do "Continuar rota" do
                    // histórico — a página server-side é que sabe carregar o
                    // KM Inicial (kmFinal da última paragem), o Tipo Veículo e
                    // o resumo da rota (noites/alimentação/paletes já
                    // registadas); só ajustar o estado local aqui deixava o
                    // formulário "esquecer-se" dos km da última vez.
                    router.push(
                      `/motorista/registo?idRota=${encodeURIComponent(r.idRota)}` +
                        `&tipoVeiculo=${encodeURIComponent(r.tipoVeiculo)}` +
                        `&kmInicial=${r.kmFinal}`,
                    );
                  }}
                >
                  <option value="">— escolher rota —</option>
                  {rotasRecentes.map((r) => (
                    <option key={r.idRota} value={r.idRota}>
                      {r.idRota}
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
            <Autocomplete
              value={f.cliente}
              onChange={(v) => set("cliente", v)}
              opcoes={clientes}
            />
            {erros.cliente && <p className="mt-1 text-xs text-red-600">{erros.cliente}</p>}
          </div>
        )}
      </div>

      <div className="card grid grid-cols-2 gap-3">
        {campoNum("kmInicial", "KM Inicial")}
        {campoNum("kmFinal", "KM Final")}
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
        {mostrarPaletes && (
          <>
            {(tipoParagem === "MISTA" || tipoParagem === "RECOLHA") && (
              <div className="col-span-2 -mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {tipoParagem === "MISTA" ? "Paletes descarregadas" : "Paletes recolhidas"}
              </div>
            )}
            <div>
              <label className="label">Tipo de palete</label>
              <select
                className="input"
                value={f.tipoPaleteId}
                onChange={(e) => set("tipoPaleteId", e.target.value)}
              >
                <option value="">— escolher —</option>
                {tiposPalete.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {erros.tipoPaleteId && <p className="mt-1 text-xs text-red-600">{erros.tipoPaleteId}</p>}
            </div>
            <div>
              <label className="label">Nº de paletes inteiras</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                placeholder="0 se for só meias-paletes"
                className="input"
                value={f.nPaletes}
                onChange={(e) => set("nPaletes", e.target.value)}
              />
              {erros.nPaletes && <p className="mt-1 text-xs text-red-600">{erros.nPaletes}</p>}
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
                  {erros[`linhaExtra${i}Tipo`] && (
                    <p className="mt-1 text-xs text-red-600">{erros[`linhaExtra${i}Tipo`]}</p>
                  )}
                </div>
                <div>
                  <label className="label">Nº de paletes</label>
                  <input
                    type="number"
                    inputMode="numeric"
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
                  {erros[`linhaExtra${i}N`] && (
                    <p className="mt-1 text-xs text-red-600">{erros[`linhaExtra${i}N`]}</p>
                  )}
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
                className="text-sm font-medium text-blue-700 underline"
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
                      {erros[`linhaCarregada${i}Tipo`] && (
                        <p className="mt-1 text-xs text-red-600">{erros[`linhaCarregada${i}Tipo`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Nº de paletes</label>
                      <input
                        type="number"
                        inputMode="numeric"
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
                      {erros[`linhaCarregada${i}N`] && (
                        <p className="mt-1 text-xs text-red-600">{erros[`linhaCarregada${i}N`]}</p>
                      )}
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
                    className="text-sm font-medium text-blue-700 underline"
                    onClick={() => setLinhasCarregadas((prev) => [...prev, { tipoPaleteId: "", nPaletes: "" }])}
                  >
                    + Adicionar palete carregada (outro tamanho)
                  </button>
                </div>
              </>
            )}

            <div>
              <label className="label">Nº de meias-paletes</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                placeholder="Em cima de outras ou sozinhas no chão"
                className="input"
                value={f.nMeiasPaletes}
                onChange={(e) => set("nMeiasPaletes", e.target.value)}
              />
              {erros.nMeiasPaletes && <p className="mt-1 text-xs text-red-600">{erros.nMeiasPaletes}</p>}
            </div>
            {tipoParagem !== "RECOLHA" && (
              <div className={tipoParagem === "MISTA" ? "" : "col-span-2"}>
                <label className="label">
                  {tipoParagem === "MISTA" ? "Peso aproximado descarregado (kg)" : "Peso aproximado (kg)"} — opcional
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="Só para estimar o consumo de combustível"
                  className="input"
                  value={f.pesoAproximado}
                  onChange={(e) => set("pesoAproximado", e.target.value)}
                />
                {erros.pesoAproximado && <p className="mt-1 text-xs text-red-600">{erros.pesoAproximado}</p>}
              </div>
            )}
            {tipoParagem !== "DESCARGA" && (
              <div className={tipoParagem === "MISTA" ? "" : "col-span-2"}>
                <label className="label">Peso aproximado recolhido (kg) — opcional</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="Só para estimar o consumo de combustível"
                  className="input"
                  value={f.pesoAproximadoCarregado}
                  onChange={(e) => set("pesoAproximadoCarregado", e.target.value)}
                />
                {erros.pesoAproximadoCarregado && (
                  <p className="mt-1 text-xs text-red-600">{erros.pesoAproximadoCarregado}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Zona Portagem</label>
          <Autocomplete
            value={f.zonaPortagem}
            onChange={(v) => set("zonaPortagem", v)}
            opcoes={zonas}
          />
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
          {mostraHorasExtra && campoNum("horasExtra", "Horas Extra")}
        </div>
        {(mostraNoitesFora || mostraAlimentacao) && (
        <div className="grid grid-cols-2 gap-3">
          {mostraNoitesFora && (
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
          )}
          {mostraAlimentacao && (
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
          )}
        </div>
        )}
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
