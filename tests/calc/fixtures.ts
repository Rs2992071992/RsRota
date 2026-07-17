import type {
  EscalaoConsumo,
  ParametrosCusto,
  PneuItem,
  PortagemItem,
} from "@/lib/calc/types";

// Parâmetros atuais (§3.4), iguais ao seed.
export const PARAMS: ParametrosCusto = {
  salarioMensal: 1345,
  seguroMensal: 30,
  percentEncargos: 0.235,
  alimentacaoDia: 6.4,
  diasAlimentacao: 19,
  kmAnuais: 95000,
  fatorAnualizacao: 14,
  valorAquisicao: 127000,
  valorResidual: 88000,
  vidaUtilAnos: 3,
  iucAnual: 600,
  taxaJuros: 0.02,
  seguroAnual: 4000,
  reparacoesAnuais: 1500,
  revisaoAnual: 1200,
  inspecaoAnual: 100,
  precoCombRef: 1.834,
  precoCombReal: 1.834,
  consumoAdblue: 2.5,
  precoAdblue: 0.3,
  margemMinima: 1.25,
  valorHoraExtra: 8,
  valorNoite: 70,
  capacidadeCamiao: 14000,
  capacidadeReboque: 24000,
  capacidadePaleteA: 38,
  capacidadePaleteB: 28,
};

export const PNEUS: PneuItem[] = [
  { custo: 1280, km: 180000 },
  { custo: 1680, km: 120000 },
  { custo: 740, km: 200000 },
  { custo: 620, km: 180000 },
  { custo: 880, km: 180000 },
];

export const TABELA_CONSUMO: EscalaoConsumo[] = [
  { cargaKg: 0, consumoL100: 25 },
  { cargaKg: 10000, consumoL100: 28 },
  { cargaKg: 15000, consumoL100: 31 },
  { cargaKg: 20000, consumoL100: 35 },
  { cargaKg: 24000, consumoL100: 38 },
  { cargaKg: 27000, consumoL100: 45 },
];

export const TABELA_PORTAGENS: PortagemItem[] = [
  { zona: "Galiza", valor: 72.7 },
  { zona: "Armazém norte", valor: 28.65 },
  { zona: "MarTorres3", valor: 14.15 },
  { zona: "VilarFormoso", valor: 18.15 },
  { zona: "Zambujeira", valor: 35.0 },
  { zona: "AveirasStubal3", valor: 11.35 },
  { zona: "MARsesimbra3", valor: 22.3 },
  { zona: "Tecges", valor: 8.7 },
  { zona: "SPortagem", valor: 0.0 },
];
