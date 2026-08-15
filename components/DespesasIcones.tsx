import { fmtEuro, fmtNum2 } from "@/lib/format";

/** Dados de despesas adicionais de uma paragem, para os ícones de aviso rápido. */
export type ParagemDespesas = {
  litrosEspanha: number | null;
  custoEspanha: number | null;
  noitesFora: number;
  alimentacao: number;
  horasExtra: number;
  portagensExtra: number;
};

/**
 * Ícones pequenos junto ao nome do cliente que sinalizam despesas extra
 * introduzidas nessa paragem (combustível Espanha, noites, alimentação,
 * horas extra, portagens), para identificar de relance quem tem valores a
 * conferir sem abrir paragem a paragem.
 */
export default function DespesasIcones({ raw }: { raw: ParagemDespesas | undefined }) {
  if (!raw) return null;
  const itens: { icone: string; titulo: string }[] = [];
  if ((raw.litrosEspanha ?? 0) > 0 || (raw.custoEspanha ?? 0) > 0) {
    itens.push({
      icone: "⛽🇪🇸",
      titulo: `Combustível em Espanha: ${fmtNum2(raw.litrosEspanha ?? 0)} L / ${fmtEuro(raw.custoEspanha ?? 0)}`,
    });
  }
  if (raw.noitesFora > 0) {
    itens.push({ icone: "🌙", titulo: `Noites fora: ${raw.noitesFora}` });
  }
  if (raw.alimentacao > 0) {
    itens.push({ icone: "🍽️", titulo: `Alimentação: ${fmtEuro(raw.alimentacao)}` });
  }
  if (raw.horasExtra > 0) {
    itens.push({ icone: "⏱️", titulo: `Horas extra: ${fmtNum2(raw.horasExtra)}` });
  }
  if (raw.portagensExtra > 0) {
    itens.push({ icone: "🛣️", titulo: `Portagens extra: ${fmtEuro(raw.portagensExtra)}` });
  }
  if (itens.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5 align-middle text-xs" title={itens.map((i) => i.titulo).join(" · ")}>
      {itens.map((i, idx) => (
        <span key={idx}>{i.icone}</span>
      ))}
    </span>
  );
}
