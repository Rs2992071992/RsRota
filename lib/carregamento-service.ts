// Carrega um carregamento (sessão de carga) com o resultado do empacotamento
// já calculado — usado pela página de detalhe e pelo endpoint de adicionar
// pedidos (para responder já com o novo estado, sem duplicar esta lógica).

import { prisma } from "@/lib/db";
import {
  empacotar,
  estimarQuantosCabem,
  expandirPedidosEmUnidades,
  type CaixaInput,
  type PaleteUnidade,
  type ResultadoPacking,
} from "@/lib/calc/paletePacking";

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

  const caixas: CaixaInput[] = [];
  if (!veiculoSemCaixaConfigurada) {
    caixas.push({
      id: "veiculo",
      label: c.veiculo.nome,
      comprimentoMm: c.veiculo.caixaComprimentoMm as number,
      larguraMm: c.veiculo.caixaLarguraMm as number,
    });
  }
  if (c.reboque) {
    caixas.push({
      id: `reboque-${c.reboque.id}`,
      label: c.reboque.nome,
      comprimentoMm: c.reboque.comprimentoMm,
      larguraMm: c.reboque.larguraMm,
    });
  }

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
