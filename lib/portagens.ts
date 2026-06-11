// Portagens automáticas para camião via TollGuru (perfil por nº de eixos, em EUR).
// Isolado e resiliente: sem chave ou em erro devolve null e o orçamento usa a tabela
// de portagens por zona (comportamento atual). TollGuru também devolve a distância
// (rota do camião), que aproveitamos quando disponível.

const TG_URL = "https://apis.tollguru.com/toll/v2/origin-destination-waypoints";
const TIMEOUT_MS = 15000;

export interface PortagemResult {
  /** Distância só de ida (km) calculada pelo TollGuru, ou null. */
  km: number | null;
  /** Custo de portagens só de ida (EUR), ou null se indisponível. */
  tollEur: number | null;
  erro?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Mapeia o tipo de veículo da app para o tipo de veículo do TollGuru (nº de eixos). */
function tipoTollguru(tipoVeiculo: string): string {
  switch (tipoVeiculo) {
    case "CAMIAO+REBOQUE":
      return "5AxlesTruck"; // articulado / trem rodoviário
    case "VAZIO":
      return "5AxlesTruck"; // regresso a vazio de um articulado
    case "CAMIAO":
      return "2AxlesTruck"; // camião rígido
    case "LEVE":
      return "2AxlesTruck";
    default:
      return "2AxlesTruck";
  }
}

async function fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Calcula portagens (e distância) de camião entre duas moradas via TollGuru.
 * O parser é defensivo (aceita `route` ou `routes[0]`, e custo em cash/tag) para
 * tolerar variações da resposta.
 */
export async function calcularPortagem(
  origem: string,
  destino: string,
  tipoVeiculo: string,
): Promise<PortagemResult> {
  const apiKey = process.env.TOLLGURU_API_KEY;
  if (!apiKey) return { km: null, tollEur: null, erro: "TOLLGURU_API_KEY não configurada." };
  if (!origem?.trim() || !destino?.trim()) {
    return { km: null, tollEur: null, erro: "Moradas em falta." };
  }

  try {
    const res = await fetchComTimeout(TG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        from: { address: origem },
        to: { address: destino },
        vehicleType: tipoTollguru(tipoVeiculo),
        currency: "EUR",
      }),
    });
    if (!res.ok) return { km: null, tollEur: null, erro: `TollGuru HTTP ${res.status}` };

    const data = (await res.json()) as {
      route?: TgRoute;
      routes?: TgRoute[];
    };
    const route = data.route ?? data.routes?.[0];
    if (!route) return { km: null, tollEur: null, erro: "TollGuru sem rota." };

    // Distância (km).
    let km: number | null = null;
    const dist = route.summary?.distance;
    if (dist) {
      if (numero(dist.metric) != null) km = Math.round(dist.metric as number);
      else if (numero(dist.value) != null) km = Math.round((dist.value as number) / 1000);
    }

    // Custo de portagens: preferir cash, senão tag, senão mínimo. Sem portagens => 0.
    const c = route.costs ?? {};
    const toll =
      numero(c.cash) ?? numero(c.tag) ?? numero(c.minimumTollCost) ?? 0;

    return { km, tollEur: round2(toll) };
  } catch {
    return { km: null, tollEur: null, erro: "Erro de ligação ao TollGuru." };
  }
}

interface TgRoute {
  costs?: {
    cash?: number;
    tag?: number;
    minimumTollCost?: number;
  };
  summary?: {
    distance?: { metric?: number; value?: number };
  };
}
