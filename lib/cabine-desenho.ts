/**
 * Desenhos da frente da caixa (vista de cima, frente à esquerda) usados na
 * planta de carga — ecrã (components/CarregamentoFloorPlan.tsx) e PDF
 * (lib/pdf/PlantaCargaDocument.tsx): a cabine do camião e a frente do reboque
 * (barra de tração + olhal). Fonte única das formas: cada um só converte para
 * as suas primitivas (<rect> do DOM / <Rect> do react-pdf), para o ecrã e o
 * papel nunca divergirem. Só cosmético, não entra em nenhum cálculo.
 *
 * Coordenadas no espaço próprio de cada desenho: x = comprimento (frente à
 * esquerda), y = largura do veículo.
 */

export type FormaFrente =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: "path"; d: string; stroke?: string; sw?: number; fill?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number };

export interface DesenhoFrente {
  formas: FormaFrente[];
  /** x da parte mais à esquerda (frente) e mais à direita (junto à caixa). */
  inicioX: number;
  fimX: number;
  /** Altura total do desenho (largura do veículo). */
  altura: number;
}

const ESCURO = "#15293f";
const CORPO = "#1f3a5f";
const CORPO_MEDIO = "#244670";
const CORPO_CLARO = "#2f5a8c";
const VIDRO = "#bfe0f0";
const TRACO = "#8fb3d6";
const AZUL = "#2f7fd8";

const pontosPainel = Array.from({ length: 11 }, (_, i): FormaFrente => ({
  t: "circle",
  cx: 35.5,
  cy: 78 + i * 8,
  r: 2,
  fill: VIDRO,
}));

const riscasCama = [103, 110, 117, 123, 130, 137].map(
  (y): FormaFrente => ({ t: "line", x1: 103, y1: y, x2: 115, y2: y, stroke: VIDRO, sw: 1.2 }),
);

export const CABINE: DesenhoFrente = {
  inicioX: 3,
  fimX: 137,
  altura: 240,
  formas: [
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
  ],
};

/** Frente do reboque: parede frontal, barra de tração em "A", mangueiras e olhal. */
export const FRENTE_REBOQUE: DesenhoFrente = {
  inicioX: 3,
  fimX: 128,
  altura: 240,
  formas: [
    // Barra de tração (A) e travessa
    { t: "path", d: "M104 64 L40 116", stroke: CORPO_CLARO, sw: 6 },
    { t: "path", d: "M104 176 L40 124", stroke: CORPO_CLARO, sw: 6 },
    { t: "line", x1: 104, y1: 120, x2: 22, y2: 120, stroke: CORPO_MEDIO, sw: 9 },
    { t: "line", x1: 104, y1: 96, x2: 104, y2: 144, stroke: CORPO_MEDIO, sw: 6 },
    { t: "rect", x: 60, y: 103, w: 9, h: 9, rx: 2, fill: ESCURO },
    // Mangueiras em espiral
    {
      t: "path",
      d: "M104 131 c-4 0 -4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 L28 128",
      stroke: TRACO,
      sw: 1.4,
    },
    {
      t: "path",
      d: "M104 109 c-4 0 -4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 s-4 5 -8 5 s-4 -5 -8 -5 L28 112",
      stroke: TRACO,
      sw: 1.4,
    },
    // Olhal
    { t: "rect", x: 20, y: 113, w: 14, h: 14, rx: 3, fill: ESCURO },
    { t: "circle", cx: 12, cy: 120, r: 7, stroke: CORPO, sw: 4 },
    { t: "circle", cx: 27, cy: 120, r: 2.2, fill: AZUL },
    // Parede frontal do reboque
    { t: "rect", x: 102, y: 4, w: 26, h: 232, rx: 5, fill: CORPO },
    { t: "rect", x: 122, y: 4, w: 6, h: 232, rx: 3, fill: CORPO_CLARO },
    { t: "rect", x: 102, y: 4, w: 26, h: 10, rx: 4, fill: ESCURO },
    { t: "rect", x: 102, y: 226, w: 26, h: 10, rx: 4, fill: ESCURO },
    { t: "rect", x: 102, y: 62, w: 20, h: 4, fill: CORPO_MEDIO },
    { t: "rect", x: 102, y: 118, w: 20, h: 4, fill: CORPO_MEDIO },
    { t: "rect", x: 102, y: 174, w: 20, h: 4, fill: CORPO_MEDIO },
    { t: "rect", x: 104, y: 20, w: 3, h: 8, rx: 1, fill: "#ffffff" },
    { t: "rect", x: 104, y: 212, w: 3, h: 8, rx: 1, fill: "#ffffff" },
  ],
};

/**
 * Transformação que encaixa um desenho na zona da frente da caixa: ocupa
 * `comprimentoMm` (acabando em `fimXMm`), na escala uniforme que ainda cabe
 * na largura da caixa, centrado. Devolve o `translate`+`scale` em unidades mm.
 */
export function transformFrente(
  d: DesenhoFrente,
  larguraCaixaMm: number,
  comprimentoMm: number,
  fimXMm: number,
) {
  const escala = Math.min(comprimentoMm / (d.fimX - d.inicioX), larguraCaixaMm / d.altura);
  return {
    escala,
    tx: fimXMm - d.fimX * escala,
    ty: larguraCaixaMm / 2 - (d.altura / 2) * escala,
  };
}
