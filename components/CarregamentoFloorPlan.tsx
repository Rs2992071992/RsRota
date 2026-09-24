"use client";

import { useEffect, useRef, useState } from "react";
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

/** Espaço (mm) reservado à esquerda do x=0 da caixa para o desenho decorativo
 * da frente — cabine (veículo) ou engate (reboque, dolly de dois eixos, ex.
 * Lecitrailer/Schmitz: barra de tração + rodado próprio). Só cosmético, não
 * entra em nenhum cálculo de espaço/packing. */
function espacoFrenteMm(souReboque: boolean): number {
  return souReboque ? 500 : 600;
}

/** Desenho esquemático (vista de cima) da frente da caixa, à esquerda de x=0.
 * Cabine para o veículo trator; para o reboque, o trem de rodas + barra de
 * tração do dolly (não tem cabine própria). Puramente decorativo — cores da
 * marca (ver tailwind.config.ts::brand) em vez de cinza genérico, pneus a
 * duas cores (pneu + jante) para um estilo mais "flat icon". */
function DesenhoFrente({ larguraMm, souReboque }: { larguraMm: number; souReboque: boolean }) {
  const meio = larguraMm / 2;
  const corpo = "#1e3a5f";
  const corpoClaro = "#2c5282";
  const vidro = "#bfe0f0";
  const pneu = "#1f2937";
  const aro = "#e5e7eb";
  const farol = "#fbbf24";
  const contorno = "#ffffff";

  if (souReboque) {
    const eixo1 = meio - larguraMm * 0.32;
    const eixo2 = meio + larguraMm * 0.32;
    const raioPneu = Math.min(larguraMm * 0.0375, 69);
    const raioAro = raioPneu * 0.5;
    return (
      <g>
        {/* Barra de tração até ao engate (olhal) */}
        <rect x={-469} y={meio - 14} width={369} height={28} rx={13} fill={corpo} stroke={contorno} strokeWidth={3} />
        <circle cx={-456} cy={meio} r={23} fill="none" stroke={corpoClaro} strokeWidth={8} />
        <circle cx={-456} cy={meio} r={6} fill={farol} />
        {/* Chassis do dolly */}
        <rect x={-131} y={40} width={131} height={larguraMm - 80} rx={8} fill={corpo} stroke={contorno} strokeWidth={3} />
        {/* Rodado (2 eixos), pneu + jante */}
        {[eixo1, eixo2].map((cy) => (
          <g key={cy}>
            <circle cx={-81} cy={cy} r={raioPneu} fill={pneu} />
            <circle cx={-81} cy={cy} r={raioAro} fill={aro} />
            <circle cx={-44} cy={cy} r={raioPneu} fill={pneu} />
            <circle cx={-44} cy={cy} r={raioAro} fill={aro} />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g>
      {/* Corpo da cabine */}
      <rect x={-595} y={60} width={550} height={larguraMm - 120} rx={88} fill={corpo} stroke={contorno} strokeWidth={4} />
      {/* Para-brisas */}
      <rect x={-119} y={140} width={81} height={larguraMm - 280} rx={20} fill={vidro} stroke={corpoClaro} strokeWidth={3} />
      {/* Espelhos */}
      <rect x={-81} y={-30} width={23} height={140} rx={8} fill={corpoClaro} />
      <rect x={-81} y={larguraMm - 110} width={23} height={140} rx={8} fill={corpoClaro} />
      {/* Faróis */}
      <circle cx={-575} cy={110} r={20} fill={farol} />
      <circle cx={-575} cy={larguraMm - 110} r={20} fill={farol} />
      {/* Rodado dianteiro, pneu + jante */}
      <circle cx={-469} cy={20} r={41} fill={pneu} />
      <circle cx={-469} cy={20} r={20} fill={aro} />
      <circle cx={-469} cy={larguraMm - 20} r={41} fill={pneu} />
      <circle cx={-469} cy={larguraMm - 20} r={20} fill={aro} />
    </g>
  );
}

interface Arrasto {
  pedidoId: number;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** Unidades do viewBox (mm) por px de ecrã — o CSS `transform: translate(...px)`
   * num elemento SVG usa unidades locais do viewBox, não px reais do ecrã, por
   * isso o delta do rato tem de ser convertido antes de entrar no `dx`/`dy`. */
  escalaX: number;
  escalaY: number;
}

export default function CarregamentoFloorPlan({
  caixas,
  ordemPedidoIds,
  onReordenar,
  onRodarPalete,
  bloqueado = false,
}: {
  caixas: CaixaResultado[];
  /** Sequência de carga atual (pedidoId por ordem) — só para saber se o arrasto
   * está disponível; a nova ordem é calculada pelo pai (pode implicar separar
   * a palete arrastada da sua linha, se a linha tiver mais do que 1). */
  ordemPedidoIds?: number[];
  /** Uma palete (`pedidoId`) foi largada em cima de outra (`alvoPedidoId`),
   * antes/depois dela. Se a linha de `pedidoId` tiver mais do que 1 palete, só
   * a unidade arrastada se deve mover — cabe ao pai decidir como. */
  onReordenar?: (pedidoId: number, alvoPedidoId: number, posicao: "antes" | "depois") => void;
  /** Clicar em ↻ numa palete: separa essa palete numa linha própria e roda-a.
   * `rotacionadoAtual` = orientação com que está desenhada agora. */
  onRodarPalete?: (pedidoId: number, rotacionadoAtual: boolean) => void;
  bloqueado?: boolean;
}) {
  const arrastavel = !!onReordenar && !!ordemPedidoIds && !bloqueado;
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvoRealce, setAlvoRealce] = useState<number | null>(null);
  const arrastoRef = useRef<Arrasto | null>(null);
  arrastoRef.current = arrasto;

  // Enquanto se arrasta, ouve o ponteiro na janela (robusto a sair do bloco).
  useEffect(() => {
    if (!arrasto || !ordemPedidoIds || !onReordenar) return;

    function alvoSob(x: number, y: number): number | null {
      const el = document.elementFromPoint(x, y)?.closest("[data-pedido-id]");
      if (!el) return null;
      const pid = Number(el.getAttribute("data-pedido-id"));
      return Number.isInteger(pid) && pid !== arrastoRef.current?.pedidoId ? pid : null;
    }

    function mover(e: PointerEvent) {
      const a = arrastoRef.current;
      if (!a || e.pointerId !== a.pointerId) return;
      setArrasto({
        ...a,
        dx: (e.clientX - a.startX) * a.escalaX,
        dy: (e.clientY - a.startY) * a.escalaY,
      });
      setAlvoRealce(alvoSob(e.clientX, e.clientY));
    }

    function largar(e: PointerEvent) {
      const a = arrastoRef.current;
      if (!a || e.pointerId !== a.pointerId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pedido-id]");
      const alvo = alvoSob(e.clientX, e.clientY);
      if (alvo !== null && el) {
        const r = el.getBoundingClientRect();
        // Metade esquerda do alvo = antes; direita = depois (eixo do comprimento
        // é X no desenho). Largar na direita da última palete = mover para o fim.
        const posicao = e.clientX < r.left + r.width / 2 ? "antes" : "depois";
        onReordenar!(a.pedidoId, alvo, posicao);
      }
      setArrasto(null);
      setAlvoRealce(null);
    }

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", largar);
    window.addEventListener("pointercancel", largar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", largar);
      window.removeEventListener("pointercancel", largar);
    };
  }, [arrasto, ordemPedidoIds, onReordenar]);

  const clientes: { id: number; nome: string }[] = [];
  const vistos = new Set<number>();
  for (const cx of caixas) {
    for (const item of cx.itens) {
      if (!vistos.has(item.clienteId)) {
        vistos.add(item.clienteId);
        clientes.push({ id: item.clienteId, nome: item.clienteNome });
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
        const souReboque = cx.caixa.id.startsWith("reboque-");
        const frenteMm = espacoFrenteMm(souReboque);
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
            <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-gray-400">
              <span>◄ Frente ({souReboque ? "engate" : "cabine"})</span>
              <span>Portas ►</span>
            </div>
            <svg
              viewBox={`${-frenteMm} 0 ${cx.caixa.comprimentoMm + frenteMm} ${cx.caixa.larguraMm}`}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
              style={{
                maxHeight: 260,
                userSelect: arrastavel ? "none" : undefined,
                WebkitUserSelect: arrastavel ? "none" : undefined,
              }}
              preserveAspectRatio="xMinYMin meet"
            >
              <DesenhoFrente larguraMm={cx.caixa.larguraMm} souReboque={souReboque} />
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
              {cx.itens.map((item) => {
                const rx = raioCanto(item.comprimentoOcupado, item.larguraOcupada);
                const aArrastar = arrasto?.pedidoId === item.pedidoId;
                const realce = alvoRealce === item.pedidoId;
                const btn = Math.min(item.larguraOcupada, item.comprimentoOcupado) * 0.42;
                return (
                  <g
                    key={`${item.pedidoId}-${item.x}-${item.y}`}
                    data-pedido-id={item.pedidoId}
                    style={{
                      transform: aArrastar ? `translate(${arrasto!.dx}px, ${arrasto!.dy}px)` : undefined,
                      opacity: aArrastar ? 0.5 : 1,
                      pointerEvents: aArrastar ? "none" : undefined,
                    }}
                  >
                    <rect
                      x={item.y}
                      y={item.x}
                      width={item.comprimentoOcupado}
                      height={item.larguraOcupada}
                      rx={rx}
                      fill={corDoCliente(item.clienteId)}
                      stroke={realce ? "#111" : "#fff"}
                      strokeWidth={realce ? 14 : 6}
                      style={{
                        touchAction: arrastavel ? "none" : undefined,
                        cursor: arrastavel ? "grab" : undefined,
                      }}
                      onPointerDown={
                        arrastavel
                          ? (e) => {
                              // Sem isto, o browser entra em modo de seleção de texto ao
                              // arrastar (realça os nomes) em vez de só mover a palete.
                              e.preventDefault();
                              const svg = e.currentTarget.ownerSVGElement;
                              const ctm = svg?.getScreenCTM();
                              setArrasto({
                                pedidoId: item.pedidoId,
                                pointerId: e.pointerId,
                                startX: e.clientX,
                                startY: e.clientY,
                                dx: 0,
                                dy: 0,
                                escalaX: ctm && ctm.a ? 1 / ctm.a : 1,
                                escalaY: ctm && ctm.d ? 1 / ctm.d : 1,
                              });
                            }
                          : undefined
                      }
                    >
                      <title>
                        {`${item.clienteNome} — ${item.tipoPaleteNome}`}
                        {arrastavel ? " (arrasta para reposicionar)" : ""}
                      </title>
                    </rect>
                    <foreignObject
                      x={item.y}
                      y={item.x}
                      width={item.comprimentoOcupado}
                      height={item.larguraOcupada}
                      style={{ pointerEvents: "none" }}
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
                    {onRodarPalete && !aArrastar && (
                      <foreignObject
                        x={item.y + item.comprimentoOcupado - btn - 24}
                        y={item.x + 24}
                        width={btn}
                        height={btn}
                      >
                        <button
                          // @ts-expect-error -- xmlns só é necessário para serialização estática
                          xmlns="http://www.w3.org/1999/xhtml"
                          type="button"
                          title="Rodar esta palete"
                          disabled={bloqueado}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onRodarPalete(item.pedidoId, item.rotacionado)}
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,.9)",
                            color: "#1a202c",
                            fontSize: btn * 0.6,
                            fontFamily: "inherit",
                            lineHeight: 1,
                            cursor: "pointer",
                            padding: 0,
                            boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                          }}
                        >
                          ↻
                        </button>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
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
