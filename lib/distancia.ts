// Cálculo de distância rodoviária via OpenRouteService (perfil pesado, driving-hgv).
// Isolado atrás de uma interface simples para se poder trocar de fornecedor depois.
// NUNCA lança: em caso de erro (sem chave, rede, morada não encontrada) devolve
// `{ km: null, erro }` e o UI cai na introdução manual do km.

const ORS_BASE = "https://api.openrouteservice.org";
const TIMEOUT_MS = 12000;

export interface DistanciaResult {
  /** Distância só de ida, em km (arredondada). null se não foi possível calcular. */
  km: number | null;
  erro?: string;
}

/** Coordenadas [lon, lat] (ordem GeoJSON/ORS). */
type Coord = [number, number];

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Geocodifica uma morada → [lon, lat] do melhor resultado, ou null. */
async function geocodificar(apiKey: string, morada: string): Promise<Coord | null> {
  const url =
    `${ORS_BASE}/geocode/search?api_key=${encodeURIComponent(apiKey)}` +
    `&text=${encodeURIComponent(morada)}&size=1`;
  const res = await fetchComTimeout(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { geometry?: { coordinates?: number[] } }[];
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  return [coords[0], coords[1]];
}

/** Distância rodoviária pesado entre dois pontos (metros), ou null. */
async function rotaHgvMetros(apiKey: string, a: Coord, b: Coord): Promise<number | null> {
  const url =
    `${ORS_BASE}/v2/directions/driving-hgv?api_key=${encodeURIComponent(apiKey)}` +
    `&start=${a[0]},${a[1]}&end=${b[0]},${b[1]}`;
  const res = await fetchComTimeout(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { properties?: { summary?: { distance?: number } } }[];
  };
  const metros = data.features?.[0]?.properties?.summary?.distance;
  return typeof metros === "number" ? metros : null;
}

/**
 * Distância rodoviária (perfil pesado) entre duas moradas, só de ida, em km.
 * Resiliente: devolve { km: null, erro } em vez de lançar.
 */
export async function calcularDistanciaKm(
  origem: string,
  destino: string,
): Promise<DistanciaResult> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return { km: null, erro: "ORS_API_KEY não configurada." };
  if (!origem?.trim() || !destino?.trim()) {
    return { km: null, erro: "Morada de origem/destino em falta." };
  }

  try {
    const [a, b] = await Promise.all([
      geocodificar(apiKey, origem),
      geocodificar(apiKey, destino),
    ]);
    if (!a) return { km: null, erro: "Origem não encontrada no mapa." };
    if (!b) return { km: null, erro: "Destino não encontrado no mapa." };

    const metros = await rotaHgvMetros(apiKey, a, b);
    if (metros == null) return { km: null, erro: "Não foi possível calcular a rota." };

    return { km: Math.round(metros / 1000) };
  } catch {
    return { km: null, erro: "Erro de ligação ao serviço de mapas." };
  }
}
