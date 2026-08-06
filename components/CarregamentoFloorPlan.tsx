"use client";

import type { CaixaResultado } from "@/lib/calc/paletePacking";

// Paleta categórica fixa (8 cores) — atribuída por ordem de 1ª aparição do
// cliente no carregamento (nunca reordenada por tamanho/frequência). Nunca
// depende só da cor: cada retângulo tem texto + legenda, para acessibilidade
// e para não ambiguar quando há mais de 8 clientes na mesma carga.
const CORES_CATEGORICAS = [
  "#2a78d6",
  "#008300",
  "#e87ba4",
  "#eda100",
  "#1baf7a",
  "#eb6834",
  "#4a3aa7",
  "#e34948",
];

/** Cantos arredondados dos paletes — proporcional ao tamanho, com limite para não
 * distorcer paletes pequenas/estreitas. */
function raioCanto(comprimento: number, largura: number): number {
  return Math.min(Math.min(comprimento, largura) * 0.12, 60);
}

export default function CarregamentoFloorPlan({ caixas }: { caixas: CaixaResultado[] }) {
  const clientes: { id: number; nome: string }[] = [];
  const vistos = new Set<number>();
  for (const cx of caixas) {
    for (const p of cx.prateleiras) {
      for (const item of p.itens) {
        if (!vistos.has(item.clienteId)) {
          vistos.add(item.clienteId);
          clientes.push({ id: item.clienteId, nome: item.clienteNome });
        }
      }
    }
  }
  const corDoCliente = (clienteId: number) => {
    const i = clientes.findIndex((c) => c.id === clienteId);
    return CORES_CATEGORICAS[i % CORES_CATEGORICAS.length];
  };

  if (caixas.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
        Este veículo não tem caixa configurada — defina o comprimento e a largura em Veículos para
        ver a planta de carga.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {caixas.map((cx) => {
        const pct = cx.areaTotalMm2 > 0 ? Math.round((cx.areaUsadaMm2 / cx.areaTotalMm2) * 100) : 0;
        return (
          <div key={cx.caixa.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-700">{cx.caixa.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {Math.round(cx.comprimentoUsadoMm)} / {cx.caixa.comprimentoMm} mm
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-brand/15">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </span>
                  {pct}%
                </span>
              </div>
            </div>
            {/* Desenhado na horizontal: o eixo do comprimento (o mais comprido)
                fica em X, a largura em Y — mais natural para ler um camião
                visto de cima do que a orientação vertical (comprimento em Y). */}
            <svg
              viewBox={`0 0 ${cx.caixa.comprimentoMm} ${cx.caixa.larguraMm}`}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
              style={{ maxHeight: 260 }}
              preserveAspectRatio="xMinYMin meet"
            >
              <rect
                x={4}
                y={4}
                width={cx.caixa.comprimentoMm - 8}
                height={cx.caixa.larguraMm - 8}
                rx={16}
                fill="none"
                stroke="#d8d6cc"
                strokeWidth={8}
              />
              {cx.prateleiras.flatMap((p) =>
                p.itens.map((item) => {
                  const rx = raioCanto(item.comprimentoOcupado, item.larguraOcupada);
                  return (
                    <g key={`${item.pedidoId}-${item.x}-${item.y}`}>
                      <rect
                        x={item.y}
                        y={item.x}
                        width={item.comprimentoOcupado}
                        height={item.larguraOcupada}
                        rx={rx}
                        fill={corDoCliente(item.clienteId)}
                        stroke="#fff"
                        strokeWidth={6}
                      >
                        <title>{`${item.clienteNome} — ${item.tipoPaleteNome}`}</title>
                      </rect>
                      <foreignObject
                        x={item.y}
                        y={item.x}
                        width={item.comprimentoOcupado}
                        height={item.larguraOcupada}
                      >
                        <div
                          // @ts-expect-error -- xmlns só é necessário para serialização estática
                          xmlns="http://www.w3.org/1999/xhtml"
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 8px",
                            boxSizing: "border-box",
                          }}
                        >
                          <span
                            style={{
                              color: "#fff",
                              fontWeight: 600,
                              fontFamily: "inherit",
                              fontSize: Math.max(
                                Math.min(item.larguraOcupada, item.comprimentoOcupado) / 7,
                                20,
                              ),
                              lineHeight: 1.15,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              textShadow: "0 1px 3px rgba(0,0,0,.35)",
                            }}
                          >
                            {item.clienteNome}
                          </span>
                        </div>
                      </foreignObject>
                    </g>
                  );
                }),
              )}
            </svg>
          </div>
        );
      })}

      {clientes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clientes.map((c, i) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 shadow-sm"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: CORES_CATEGORICAS[i % CORES_CATEGORICAS.length] }}
              />
              {c.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
