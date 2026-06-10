// Formatação em Português de Portugal.

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num0 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const fmtEuro = (v: number) => eur.format(v || 0);
export const fmtNum = (v: number) => num0.format(v || 0);
export const fmtNum2 = (v: number) => num2.format(v || 0);
export const fmtPct = (v: number) => pct.format(v || 0);
export const fmtData = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
