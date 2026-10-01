/**
 * Desenho da cabine do camião (vista de cima, frente à esquerda) usado na
 * planta de carga — ecrã (components/CarregamentoFloorPlan.tsx) e PDF
 * (lib/pdf/PlantaCargaDocument.tsx). Fonte única das formas: cada um só
 * converte para as suas primitivas (<rect> do DOM / <Rect> do react-pdf), para
 * o ecrã e o papel nunca divergirem. Só cosmético, não entra em nenhum cálculo.
 *
 * Coordenadas no espaço próprio do desenho (140 × 240): x = comprimento
 * (frente em x≈3), y = largura do camião.
 */

export const CABINE_LARGURA = 140;
export const CABINE_ALTURA = 240;
/** x onde acaba a traseira da cabine (a parte mais à direita do desenho). */
export const CABINE_FIM_X = 137;
/** x onde começa a frente da cabine (a parte mais à esquerda do corpo). */
export const CABINE_INICIO_X = 3;

export type FormaCabine =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string }
  | { t: "path"; d: string; stroke?: string; sw?: number; fill?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number };

const ESCURO = "#15293f";
const CORPO = "#1f3a5f";
const CORPO_MEDIO = "#244670";
const CORPO_CLARO = "#2f5a8c";
const VIDRO = "#bfe0f0";
const TRACO = "#8fb3d6";
const AZUL = "#2f7fd8";

const pontosPainel = Array.from({ length: 11 }, (_, i): FormaCabine => ({
  t: "circle",
  cx: 35.5,
  cy: 78 + i * 8,
  r: 2,
  fill: VIDRO,
}));

const riscasCama = [103, 110, 117, 123, 130, 137].map(
  (y): FormaCabine => ({ t: "line", x1: 103, y1: y, x2: 115, y2: y, stroke: VIDRO, sw: 1.2 }),
);

export const CABINE_FORMAS: FormaCabine[] = [
  // Espelhos / rodas salientes (cima e baixo)
  { t: "rect", x: 22, y: 9, w: 5, h: 7, fill: ESCURO },
  { t: "rect", x: 14, y: 2, w: 20, h: 9, rx: 3, fill: ESCURO },
  { t: "rect", x: 22, y: 224, w: 5, h: 7, fill: ESCURO },
  { t: "rect", x: 14, y: 229, w: 20, h: 9, rx: 3, fill: ESCURO },
  // Corpo, para-brisas e interior
  { t: "rect", x: 3, y: 14, w: 134, h: 212, rx: 16, fill: CORPO },
  { t: "rect", x: 9, y: 24, w: 12, h: 192, rx: 5, fill: VIDRO },
  { t: "rect", x: 21, y: 22, w: 4, h: 196, rx: 2, fill: ESCURO },
  { t: "rect", x: 52, y: 24, w: 78, h: 192, rx: 10, fill: CORPO_MEDIO },
  { t: "path", d: "M72 31 L53 31 Q46 31 46 38 L46 202 Q46 209 53 209 L72 209", stroke: TRACO, sw: 3 },
  // Painel de instrumentos
  { t: "rect", x: 30, y: 70, w: 11, h: 100, rx: 4, fill: ESCURO },
  ...pontosPainel,
  { t: "circle", cx: 35, cy: 39, r: 6, fill: ESCURO },
  { t: "circle", cx: 35, cy: 39, r: 2.4, fill: AZUL },
  { t: "circle", cx: 35, cy: 201, r: 6, fill: ESCURO },
  { t: "circle", cx: 35, cy: 201, r: 2.4, fill: AZUL },
  // Alavanca e banco
  { t: "line", x1: 62, y1: 90, x2: 80, y2: 88, stroke: TRACO, sw: 1.6 },
  { t: "circle", cx: 62, cy: 90, r: 3.5, fill: ESCURO },
  { t: "path", d: "M55 180 Q63 174 71 180 Q63 185 55 180 Z", fill: ESCURO },
  // Cama
  { t: "rect", x: 80, y: 74, w: 46, h: 92, rx: 14, fill: CORPO_CLARO },
  { t: "rect", x: 98, y: 96, w: 22, h: 48, rx: 6, fill: CORPO },
  ...riscasCama,
  { t: "rect", x: 86, y: 86, w: 4, h: 68, rx: 2, fill: CORPO_MEDIO },
];

/**
 * Transformação que encaixa a cabine na zona da frente da caixa: ocupa
 * `comprimentoMm` (de `fimXMm` para trás), na escala uniforme que ainda cabe
 * na largura da caixa, centrada. Devolve o `translate`+`scale` em unidades mm.
 */
export function transformCabine(larguraCaixaMm: number, comprimentoMm: number, fimXMm: number) {
  const escala = Math.min(comprimentoMm / (CABINE_FIM_X - CABINE_INICIO_X), larguraCaixaMm / CABINE_ALTURA);
  return {
    escala,
    tx: fimXMm - CABINE_FIM_X * escala,
    ty: larguraCaixaMm / 2 - (CABINE_ALTURA / 2) * escala,
  };
}
