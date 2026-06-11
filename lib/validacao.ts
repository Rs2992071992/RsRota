import { z } from "zod";

export const TIPOS_VIAGEM = ["Ida", "Volta"] as const;
export const TIPOS_VEICULO = [
  "CAMIAO",
  "CAMIAO+REBOQUE",
  "LEVE",
  "VAZIO",
] as const;

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
    litrosAbastecidos: numNaoNeg.default(0),
    custoAbastecido: numNaoNeg.default(0),
    zonaPortagem: z.string().trim().default(""),
    portagensExtra: numNaoNeg.default(0),
    noitesFora: numNaoNeg.default(0),
    alimentacao: numNaoNeg.default(0),
    horasExtra: numNaoNeg.default(0),
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
  pneus: z.array(z.object({ eixo: z.string().trim().min(1), custo: n, km: n.positive() })),
});

export type VeiculoForm = z.infer<typeof veiculoSchema>;

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
  zonaPortagem: z.string().trim().max(120).nullable().default(null),
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
  zonaPortagem: z.string().trim().nullable().default(null),
  motoristaId: z.number().int().positive().nullable().optional(),
  veiculoId: z.number().int().positive().nullable().optional(),
  /** Se preenchido, ignora o cálculo automático de distância e usa este km (ida). */
  kmManual: z.number().nonnegative().nullable().optional(),
});

export type EstimarDevisForm = z.infer<typeof estimarDevisSchema>;
