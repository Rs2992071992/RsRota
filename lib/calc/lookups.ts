import type { EscalaoConsumo, PortagemItem } from "./types";

/**
 * VLOOKUP aproximado (equivalente ao VLOOKUP com TRUE do Excel):
 * devolve o consumo do maior escalão cujo cargaKg <= peso.
 * Para peso abaixo do primeiro escalão, usa o primeiro.
 */
export function consumoPorCarga(peso: number, tabela: EscalaoConsumo[]): number {
  if (tabela.length === 0) return 0;
  const ordenada = [...tabela].sort((a, b) => a.cargaKg - b.cargaKg);
  let escolhido = ordenada[0];
  for (const e of ordenada) {
    if (peso >= e.cargaKg) escolhido = e;
    else break;
  }
  return escolhido.consumoL100;
}

/**
 * Lookup do valor de portagem pela zona. Devolve 0 se a zona não existir
 * (tratamento gracioso — sem #REF!). `existe` indica se houve match.
 */
export function valorPortagem(
  zona: string,
  tabela: PortagemItem[],
): { valor: number; existe: boolean } {
  const z = (zona || "").trim();
  if (!z) return { valor: 0, existe: true }; // sem zona = sem portagem (válido)
  const match = tabela.find((p) => p.zona.trim().toLowerCase() === z.toLowerCase());
  return match ? { valor: match.valor, existe: true } : { valor: 0, existe: false };
}
