import { z } from "zod";

export const TIPOS_VIAGEM = ["Ida", "Volta"] as const;
export const TIPOS_VEICULO = [
  "CAMIAO",
  "CAMIAO+REBOQUE",
  "VAZIO",
  "PALETE_120X80",
  "PALETE_120X100",
] as const;

/** Rótulos amigáveis para os tipos de palete (capacidade por camião). */
export const ROTULOS_TIPO_VEICULO: Record<string, string> = {
  PALETE_120X80: "Palete 120×80cm (38/camião)",
  PALETE_120X100: "Palete 120×100cm (28/camião)",
};

const numNaoNeg = z.number().nonnegative("Não pode ser negativo");
const numOpcional = z.number().nonnegative("Não pode ser negativo").nullable().optional();

/** Schema de uma paragem (entrada do motorista §3.1). */
export const paragemSchema = z
  .object({
    // Opcional: vazio/ausente => rota nova (o servidor gera o ID); preenchido => continuar rota.
    idRota: z.string().trim().optional(),
    data: z.string().min(1, "Data obrigatória"),
    tipoViagem: z.enum(TIPOS_VIAGEM),
    tipoVeiculo: z.enum(TIPOS_VEICULO),
    veiculoId: z.number().int().positive().nullable().optional(),
    cliente: z.string().trim().min(1, "Cliente obrigatório"),
    kmInicial: numNaoNeg,
    kmFinal: numNaoNeg,
    kgCarregados: numNaoNeg.default(0),
    kgDescarregados: numNaoNeg.default(0),
    nPaletes: numNaoNeg.default(0),
    litrosAbastecidos: numNaoNeg.default(0),
    custoAbastecido: numNaoNeg.default(0),
    zonaPortagem: z.string().trim().default(""),
    portagensExtra: numNaoNeg.default(0),
    noitesFora: numNaoNeg.default(0),
    alimentacao: numNaoNeg.default(0),
    horasExtra: numNaoNeg.default(0),
    // Recolha para entregar a outro cliente: `recolha` é o assinalar do
    // motorista (sem escolher destino); `faturarCliente` é o nome do
    // cliente a faturar, preenchido pelo escritório (null/vazio = fatura
    // normalmente ao próprio `cliente`).
    recolha: z.boolean().default(false),
    faturarCliente: z.string().trim().nullable().optional(),
    precoCombRefOverride: numOpcional,
    receitaPaga: numNaoNeg.default(0),
    pago: z.boolean().default(false),
    dataPagamento: z.string().nullable().optional(),
    litrosEspanha: numOpcional,
    custoEspanha: numOpcional,
  })
  .refine((d) => d.kmFinal >= d.kmInicial, {
    message: "KM Final deve ser ≥ KM Inicial",
    path: ["kmFinal"],
  });

export type ParagemForm = z.infer<typeof paragemSchema>;

/** Override do preço de ref. combustível para TODAS as paragens de uma rota
 * de uma vez (corrigir rota a rota sem editar paragem a paragem). null/vazio
 * = volta a usar o valor global de Parâmetros. */
export const rotaOverrideSchema = z.object({
  precoCombRefOverride: numOpcional,
});

export type RotaOverrideForm = z.infer<typeof rotaOverrideSchema>;

const n = z.number().finite();

/** Schema de um veículo da frota (custos próprios + pneus). */
export const veiculoSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  matricula: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
  valorAquisicao: n,
  valorResidual: n,
  vidaUtilAnos: n.positive("Deve ser > 0"),
  iucAnual: n,
  taxaJuros: n,
  seguroAnual: n,
  reparacoesAnuais: n,
  revisaoAnual: n,
  inspecaoAnual: n,
  capacidadeCamiao: n.positive("Deve ser > 0"),
  capacidadeReboque: n.positive("Deve ser > 0"),
  capacidadePaleteA: n.positive("Deve ser > 0"),
  capacidadePaleteB: n.positive("Deve ser > 0"),
  // Caixa de carga (mm) — opcional, só usado no empacotamento de paletes (Cargas).
  caixaComprimentoMm: n.positive("Deve ser > 0").nullable().optional(),
  caixaLarguraMm: n.positive("Deve ser > 0").nullable().optional(),
  // Inspeção periódica — prazo + confirmação de que já foi feita.
  dataLimiteInspecao: z.string().trim().nullable().optional(),
  inspecaoVerificada: z.boolean().optional(),
  pneus: z.array(z.object({ eixo: z.string().trim().min(1), custo: n, km: n.positive() })),
});

export type VeiculoForm = z.infer<typeof veiculoSchema>;

/** Schema de uma manutenção/reparação de veículo. `valor`/`dias` ficam por
 * preencher até se saber o custo/tempo parado real. */
export const manutencaoSchema = z.object({
  descricao: z.string().trim().max(300).default(""),
  data: z.string().min(1, "Data obrigatória"),
  valor: z.number().nonnegative().nullable().optional(),
  dias: z.number().nonnegative().nullable().optional(),
});

export const manutencaoUpdateSchema = manutencaoSchema.partial();

export type ManutencaoForm = z.infer<typeof manutencaoSchema>;

/** Schema dos parâmetros salariais próprios de um motorista. */
export const motoristaParamsSchema = z.object({
  nome: z.string().trim().nullable().optional(),
  salarioMensal: n,
  seguroMensal: n,
  percentEncargos: n,
  alimentacaoDia: n,
  diasAlimentacao: n,
  kmAnuais: n.positive("Deve ser > 0"),
  fatorAnualizacao: n,
});

export type MotoristaParamsForm = z.infer<typeof motoristaParamsSchema>;

/** Schema da ficha de contacto de um cliente (só dados de contacto). */
const txtContacto = z.string().trim().max(500).nullable().optional();
export const clienteContactoSchema = z.object({
  nome: z.string().trim().min(1, "Cliente obrigatório"),
  contato: txtContacto,
  telefone: txtContacto,
  email: txtContacto,
  morada: txtContacto,
  notas: txtContacto,
});

export type ClienteContactoForm = z.infer<typeof clienteContactoSchema>;

/** Agrupar/fundir variantes de nome de cliente num nome canónico. */
export const agruparClientesSchema = z.object({
  nomesVariantes: z.array(z.string().trim().min(1)).min(1, "Selecione pelo menos um nome"),
  nomeCanonico: z.string().trim().min(1, "Nome canónico obrigatório"),
});

export type AgruparClientesForm = z.infer<typeof agruparClientesSchema>;

/** Estados possíveis de um orçamento. */
export const ESTADOS_DEVIS = ["RASCUNHO", "ENVIADO", "ACEITE", "RECUSADO"] as const;

/** Uma linha de orçamento (corresponde a LinhaDevis em lib/calc/orcamento.ts). */
export const linhaDevisSchema = z.object({
  descricao: z.string().trim().max(300).default(""),
  origem: z.string().trim().max(300).default(""),
  destino: z.string().trim().max(300).default(""),
  kmAuto: z.number().nonnegative().nullable().default(null),
  idaVolta: z.boolean().default(true),
  km: numNaoNeg.default(0),
  pesoKg: numNaoNeg.default(0),
  tipoVeiculo: z.enum(TIPOS_VEICULO).default("CAMIAO"),
  nPaletes: numNaoNeg.default(0),
  zonaPortagem: z.string().trim().max(120).nullable().default(null),
  noitesFora: numNaoNeg.default(0),
  alimentacao: numNaoNeg.default(0),
  custoEstimado: numNaoNeg.default(0),
  preco: numNaoNeg.default(0),
});

/** Schema de criação de um orçamento. O número e os totais são calculados no servidor. */
export const devisSchema = z.object({
  cliente: z.string().trim().min(1, "Cliente obrigatório"),
  clienteEmail: txtContacto,
  clienteMorada: txtContacto,
  clienteContato: txtContacto,
  validade: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_DEVIS).default("RASCUNHO"),
  origemPadrao: txtContacto,
  linhas: z.array(linhaDevisSchema).default([]),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  ivaPercent: z.number().min(0).max(100).default(23),
});

export type DevisForm = z.infer<typeof devisSchema>;

/** Entrada do endpoint de estimativa de uma linha (calcula km via mapas + custo). */
export const estimarDevisSchema = z.object({
  origem: z.string().trim().default(""),
  destino: z.string().trim().default(""),
  idaVolta: z.boolean().default(true),
  pesoKg: numNaoNeg.default(0),
  tipoVeiculo: z.enum(TIPOS_VEICULO).default("CAMIAO"),
  nPaletes: numNaoNeg.default(0),
  zonaPortagem: z.string().trim().nullable().default(null),
  noitesFora: numNaoNeg.default(0),
  alimentacao: numNaoNeg.default(0),
  motoristaId: z.number().int().positive().nullable().optional(),
  veiculoId: z.number().int().positive().nullable().optional(),
  /** Se preenchido, ignora o cálculo automático de distância e usa este km (ida). */
  kmManual: z.number().nonnegative().nullable().optional(),
});

export type EstimarDevisForm = z.infer<typeof estimarDevisSchema>;

// --- Cargas / empacotamento de paletes -----------------------------------

/** Catálogo de tipos de palete (mm), editável em Parâmetros. */
export const tipoPaleteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  comprimentoMm: n.positive("Deve ser > 0"),
  larguraMm: n.positive("Deve ser > 0"),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

export const tipoPaleteUpdateSchema = tipoPaleteSchema.partial();

export type TipoPaleteForm = z.infer<typeof tipoPaleteSchema>;

/** Catálogo de reboques (mm) — independente do veículo, escolhido por carregamento. */
export const reboqueSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  matricula: z.string().trim().nullable().optional(),
  comprimentoMm: n.positive("Deve ser > 0"),
  larguraMm: n.positive("Deve ser > 0"),
  ativo: z.boolean().optional(),
});

export const reboqueUpdateSchema = reboqueSchema.partial();

export type ReboqueForm = z.infer<typeof reboqueSchema>;

export const ESTADOS_CARREGAMENTO = ["ABERTO", "FECHADO"] as const;

/** Criação de um carregamento (sessão de carga) para um veículo. */
export const carregamentoSchema = z.object({
  veiculoId: z.number().int().positive("Veículo obrigatório"),
  data: z.string().nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
});

export type CarregamentoForm = z.infer<typeof carregamentoSchema>;

/** Atualização de um carregamento: anexar/trocar/remover reboque, fechar/reabrir, notas. */
export const carregamentoUpdateSchema = z.object({
  estado: z.enum(ESTADOS_CARREGAMENTO).optional(),
  reboqueId: z.number().int().positive().nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
});

export type CarregamentoUpdateForm = z.infer<typeof carregamentoUpdateSchema>;

/** Linha de pedido: cliente + tipo de palete + quantidade. Guarda-se mesmo
 * que não caiba fisicamente (o compromisso ao cliente já foi feito). */
export const pedidoPaleteSchema = z.object({
  clienteId: z.number().int().positive("Cliente obrigatório"),
  tipoPaleteId: z.number().int().positive("Tipo de palete obrigatório"),
  quantidade: z.number().int().positive("Quantidade deve ser > 0"),
});

export type PedidoPaleteForm = z.infer<typeof pedidoPaleteSchema>;

export const pedidoPaleteUpdateSchema = z.object({
  quantidade: z.number().int().positive("Quantidade deve ser > 0"),
});

export type PedidoPaleteUpdateForm = z.infer<typeof pedidoPaleteUpdateSchema>;
