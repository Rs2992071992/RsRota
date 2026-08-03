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
    <div className="space-y-4">
      {caixas.map((cx) => (
        <div key={cx.caixa.id}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">{cx.caixa.label}</span>
            <span className="text-gray-500">
              {Math.round(cx.comprimentoUsadoMm)} / {cx.caixa.comprimentoMm} mm ·{" "}
              {cx.areaTotalMm2 > 0 ? Math.round((cx.areaUsadaMm2 / cx.areaTotalMm2) * 100) : 0}%
              ocupado
            </span>
          </div>
          <svg
            viewBox={`0 0 ${cx.caixa.larguraMm} ${cx.caixa.comprimentoMm}`}
            className="w-full rounded border border-gray-200 bg-gray-50"
            style={{ maxHeight: 420 }}
            preserveAspectRatio="xMinYMin meet"
          >
            <rect
              x={0}
              y={0}
              width={cx.caixa.larguraMm}
              height={cx.caixa.comprimentoMm}
              fill="none"
              stroke="#e1e0d9"
              strokeWidth={8}
            />
            {cx.prateleiras.flatMap((p) =>
              p.itens.map((item) => (
                <g key={`${item.pedidoId}-${item.x}-${item.y}`}>
                  <rect
                    x={item.x}
                    y={item.y}
                    width={item.larguraOcupada}
                    height={item.comprimentoOcupado}
                    fill={corDoCliente(item.clienteId)}
                    stroke="#fff"
                    strokeWidth={4}
                  >
                    <title>{`${item.clienteNome} — ${item.tipoPaleteNome}`}</title>
                  </rect>
                  <text
                    x={item.x + item.larguraOcupada / 2}
                    y={item.y + item.comprimentoOcupado / 2}
                    fill="#fff"
                    fontSize={Math.max(Math.min(item.larguraOcupada, item.comprimentoOcupado) / 6, 24)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {item.clienteNome}
                  </text>
                </g>
              )),
            )}
          </svg>
        </div>
      ))}

      {clientes.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {clientes.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm"
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
