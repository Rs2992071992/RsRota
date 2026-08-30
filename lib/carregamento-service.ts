// Carrega um carregamento (sessão de carga) com o resultado do empacotamento
// já calculado — usado pela página de detalhe e pelo endpoint de adicionar
// pedidos (para responder já com o novo estado, sem duplicar esta lógica).

import { prisma } from "@/lib/db";
import {
  empacotar,
  estimarQuantosCabem,
  expandirPedidosEmUnidades,
  otimizarOrdem,
  type CaixaInput,
  type OrientacaoPalete,
  type PaleteUnidade,
  type PedidoParaExpandir,
  type ResultadoPacking,
} from "@/lib/calc/paletePacking";

/** Constrói a lista de caixas (veículo + reboque anexado, por esta ordem) para
 * o motor de empacotamento. Veículo sem comprimento/largura definidos não entra. */
export function construirCaixas(
  veiculo: { nome: string; caixaComprimentoMm: number | null; caixaLarguraMm: number | null },
  reboque: { id: number; nome: string; comprimentoMm: number; larguraMm: number } | null,
): CaixaInput[] {
  const caixas: CaixaInput[] = [];
  if (veiculo.caixaComprimentoMm != null && veiculo.caixaLarguraMm != null) {
    caixas.push({
      id: "veiculo",
      label: veiculo.nome,
      comprimentoMm: veiculo.caixaComprimentoMm,
      larguraMm: veiculo.caixaLarguraMm,
    });
  }
  if (reboque) {
    caixas.push({
      id: `reboque-${reboque.id}`,
      label: reboque.nome,
      comprimentoMm: reboque.comprimentoMm,
      larguraMm: reboque.larguraMm,
    });
  }
  return caixas;
}

export interface SugestaoReboque {
  id: number;
  nome: string;
  matricula: string | null;
  comprimentoMm: number;
  larguraMm: number;
  quantosCabemDosEmFalta: number;
  caberiamTodos: boolean;
}

export interface CarregamentoDetalhe {
  id: number;
  data: Date;
  estado: string;
  notas: string | null;
  veiculo: {
    id: number;
    nome: string;
    matricula: string | null;
    caixaComprimentoMm: number | null;
    caixaLarguraMm: number | null;
  };
  veiculoSemCaixaConfigurada: boolean;
  reboque: { id: number; nome: string; comprimentoMm: number; larguraMm: number } | null;
  pedidos: {
    id: number;
    ordem: number;
    quantidade: number;
    clienteId: number;
    clienteNome: string;
    tipoPaleteId: number;
    tipoPaleteNome: string;
    comprimentoMm: number;
    larguraMm: number;
    orientacao: OrientacaoPalete;
  }[];
  packing: ResultadoPacking;
  /** Quantas paletes de cada tipo ativo ainda cabem, dado o estado atual. */
  estimativasRestantes: { tipoPaleteId: number; tipoPaleteNome: string; quantosCabem: number }[];
  /** Só não-nulo quando há paletes sem espaço (packing.naoColocados não vazio). */
  sugestoesReboque: SugestaoReboque[] | null;
}

export async function carregarCarregamento(id: number): Promise<CarregamentoDetalhe | null> {
  const c = await prisma.carregamento.findUnique({
    where: { id },
    include: {
      veiculo: true,
      reboque: true,
      pedidos: {
        orderBy: { ordem: "asc" },
        include: { cliente: true, tipoPalete: true },
      },
    },
  });
  if (!c) return null;

  const veiculoSemCaixaConfigurada =
    c.veiculo.caixaComprimentoMm == null || c.veiculo.caixaLarguraMm == null;

  const caixas = construirCaixas(c.veiculo, c.reboque);

  const pedidosPlanos = c.pedidos.map((p) => ({
    id: p.id,
    ordem: p.ordem,
    quantidade: p.quantidade,
    clienteId: p.clienteId,
    clienteNome: p.cliente.nome,
    tipoPaleteId: p.tipoPaleteId,
    tipoPaleteNome: p.tipoPalete.nome,
    comprimentoMm: p.tipoPalete.comprimentoMm,
    larguraMm: p.tipoPalete.larguraMm,
    orientacao: p.orientacao as OrientacaoPalete,
  }));

  const unidades: PaleteUnidade[] = expandirPedidosEmUnidades(
    pedidosPlanos.map((p) => ({ ...p, pedidoId: p.id })),
  );
  const packing = empacotar(caixas, unidades);

  const tiposAtivos = await prisma.tipoPalete.findMany({
    where: { ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  const estimativasRestantes = tiposAtivos.map((t) => ({
    tipoPaleteId: t.id,
    tipoPaleteNome: t.nome,
    quantosCabem: estimarQuantosCabem(caixas, unidades, {
      tipoPaleteId: t.id,
      tipoPaleteNome: t.nome,
      comprimentoMm: t.comprimentoMm,
      larguraMm: t.larguraMm,
    }),
  }));

  let sugestoesReboque: SugestaoReboque[] | null = null;
  if (packing.naoColocados.length > 0) {
    const emFalta = packing.naoColocados.map((n) => n.unidade);
    const reboquesAtivos = await prisma.reboque.findMany({
      where: { ativo: true, id: { not: c.reboque?.id } },
    });

    sugestoesReboque = reboquesAtivos
      .map((r) => {
        const caixaCandidata: CaixaInput = {
          id: `reboque-${r.id}`,
          label: r.nome,
          comprimentoMm: r.comprimentoMm,
          larguraMm: r.larguraMm,
        };
        const simulado = empacotar([caixaCandidata], emFalta);
        return {
          id: r.id,
          nome: r.nome,
          matricula: r.matricula,
          comprimentoMm: r.comprimentoMm,
          larguraMm: r.larguraMm,
          quantosCabemDosEmFalta: simulado.colocados.length,
          caberiamTodos: simulado.colocados.length === emFalta.length,
        };
      })
      .filter((s) => s.quantosCabemDosEmFalta > 0)
      .sort((a, b) => {
        if (a.caberiamTodos !== b.caberiamTodos) return a.caberiamTodos ? -1 : 1;
        if (b.quantosCabemDosEmFalta !== a.quantosCabemDosEmFalta) {
          return b.quantosCabemDosEmFalta - a.quantosCabemDosEmFalta;
        }
        return a.comprimentoMm * a.larguraMm - b.comprimentoMm * b.larguraMm;
      });
  }

  return {
    id: c.id,
    data: c.data,
    estado: c.estado,
    notas: c.notas,
    veiculo: {
      id: c.veiculo.id,
      nome: c.veiculo.nome,
      matricula: c.veiculo.matricula,
      caixaComprimentoMm: c.veiculo.caixaComprimentoMm,
      caixaLarguraMm: c.veiculo.caixaLarguraMm,
    },
    veiculoSemCaixaConfigurada,
    reboque: c.reboque
      ? {
          id: c.reboque.id,
          nome: c.reboque.nome,
          comprimentoMm: c.reboque.comprimentoMm,
          larguraMm: c.reboque.larguraMm,
        }
      : null,
    pedidos: pedidosPlanos,
    packing,
    estimativasRestantes,
    sugestoesReboque,
  };
}

export interface SimulacaoOrdem {
  /** A ordem atual já é a melhor possível — não há reordenação que melhore. */
  jaOtima: boolean;
  /** Sequência de carga sugerida, uma entrada por linha de pedido. */
  ordemSugerida: {
    pedidoId: number;
    clienteNome: string;
    tipoPaleteNome: string;
    quantidade: number;
  }[];
  /** `pedidoId` na ordem sugerida — o endpoint aplica sem repetir o cálculo. */
  pedidoIdsOrdenados: number[];
  ganho: {
    naoColocadosAntes: number;
    naoColocadosDepois: number;
    comprimentoAntesMm: number;
    comprimentoDepoisMm: number;
    usaReboqueAntes: boolean;
    usaReboqueDepois: boolean;
  };
}

const comprimentoTotalMm = (r: ResultadoPacking) =>
  r.caixas.reduce((s, cx) => s + cx.comprimentoUsadoMm, 0);
const usaReboque = (r: ResultadoPacking) =>
  r.caixas.some((cx) => cx.caixa.id.startsWith("reboque-") && cx.comprimentoUsadoMm > 0);

/** Simula a ordem de carga otimizada de um carregamento e compara com a atual. */
export async function simularOrdemOtimizada(id: number): Promise<SimulacaoOrdem | null> {
  const c = await prisma.carregamento.findUnique({
    where: { id },
    include: {
      veiculo: true,
      reboque: true,
      pedidos: { orderBy: { ordem: "asc" }, include: { cliente: true, tipoPalete: true } },
    },
  });
  if (!c) return null;

  const caixas = construirCaixas(c.veiculo, c.reboque);
  const pedidos: PedidoParaExpandir[] = c.pedidos.map((p) => ({
    pedidoId: p.id,
    clienteId: p.clienteId,
    clienteNome: p.cliente.nome,
    tipoPaleteId: p.tipoPaleteId,
    tipoPaleteNome: p.tipoPalete.nome,
    comprimentoMm: p.tipoPalete.comprimentoMm,
    larguraMm: p.tipoPalete.larguraMm,
    ordem: p.ordem,
    quantidade: p.quantidade,
    orientacao: p.orientacao as OrientacaoPalete,
  }));

  const idsAtuais = pedidos.map((p) => p.pedidoId);
  const packingAtual = empacotar(caixas, expandirPedidosEmUnidades(pedidos));
  const { pedidoIdsOrdenados, packing: packingNovo } = otimizarOrdem(caixas, pedidos);

  const jaOtima =
    idsAtuais.length === pedidoIdsOrdenados.length &&
    idsAtuais.every((v, i) => v === pedidoIdsOrdenados[i]);

  const porId = new Map(pedidos.map((p) => [p.pedidoId, p]));
  return {
    jaOtima,
    pedidoIdsOrdenados,
    ordemSugerida: pedidoIdsOrdenados.map((pid) => {
      const p = porId.get(pid)!;
      return {
        pedidoId: pid,
        clienteNome: p.clienteNome,
        tipoPaleteNome: p.tipoPaleteNome,
        quantidade: p.quantidade,
      };
    }),
    ganho: {
      naoColocadosAntes: packingAtual.naoColocados.length,
      naoColocadosDepois: packingNovo.naoColocados.length,
      comprimentoAntesMm: comprimentoTotalMm(packingAtual),
      comprimentoDepoisMm: comprimentoTotalMm(packingNovo),
      usaReboqueAntes: usaReboque(packingAtual),
      usaReboqueDepois: usaReboque(packingNovo),
    },
  };
}
