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
