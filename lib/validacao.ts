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
    idRota: z.string().trim().min(1, "ID Rota obrigatório"),
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
