import React from "react";
import { Document, Page, View, Text, Svg, Rect, Circle, G, StyleSheet } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/pdf/empresa";
import type { CarregamentoDetalhe } from "@/lib/carregamento-service";

const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-PT");

// Mesma paleta categórica do ecrã (components/CarregamentoFloorPlan.tsx) — o
// PDF e o ecrã têm de mostrar a mesma cor para o mesmo cliente. Atribuída por
// ordem de 1ª aparição, nunca reordenada por tamanho/frequência.
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

// Largura disponível numa página A4 paisagem (842pt) menos as margens da
// página (36pt de cada lado) — as caixas (Svg) escalam a este limite mantendo
// a proporção real do comprimento/largura da caixa (mm), como no ecrã.
const LARGURA_DISPONIVEL_PT = 842 - 36 * 2;
const ALTURA_MAX_CAIXA_PT = 220;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1a202c", fontFamily: "Helvetica" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  empresa: { fontSize: 16, fontWeight: "bold" },
  empresaSub: { fontSize: 8, color: "#666", maxWidth: 240, marginTop: 2 },
  tituloBox: { alignItems: "flex-end" },
  titulo: { fontSize: 18, fontWeight: "bold", color: "#2b6cb0" },
  meta: { fontSize: 9, marginTop: 2 },
  sep: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 12 },
  caixaBloco: { marginBottom: 16 },
  caixaHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  caixaLabel: { fontSize: 11, fontWeight: "bold" },
  caixaMeta: { fontSize: 8, color: "#666" },
  legenda: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  legendaItem: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 10 },
  legendaSwatch: { width: 7, height: 7, borderRadius: 2 },
  legendaTexto: { fontSize: 8 },
  aviso: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  avisoTitulo: { fontSize: 9, fontWeight: "bold", color: "#b91c1c" },
  avisoLinha: { fontSize: 8, color: "#7f1d1d", marginTop: 2 },
  th: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontWeight: "bold",
    fontSize: 8,
  },
  td: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  cOrdem: { width: "8%" },
  cCliente: { width: "37%" },
  cTipo: { width: "30%" },
  cQtd: { width: "25%", textAlign: "right" },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
  },
});

/** Raio dos cantos dos retângulos — mesma fórmula do ecrã, proporcional ao tamanho. */
function raioCanto(comprimento: number, largura: number): number {
  return Math.min(Math.min(comprimento, largura) * 0.12, 60);
}

/** Espaço (mm) reservado à esquerda do x=0 da caixa para o desenho da frente —
 * mesmos valores/critério do ecrã (components/CarregamentoFloorPlan.tsx). */
function espacoFrenteMm(souReboque: boolean): number {
  return souReboque ? 1500 : 1900;
}

/** Desenho esquemático (vista de cima) da frente da caixa — mesmo desenho do
 * ecrã (components/CarregamentoFloorPlan.tsx::DesenhoFrente), em primitivas do
 * react-pdf. Cabine para o veículo trator; trem de rodas + barra de tração do
 * dolly para o reboque (não tem cabine própria). Puramente decorativo. */
function DesenhoFrentePdf({ larguraMm, souReboque }: { larguraMm: number; souReboque: boolean }) {
  const meio = larguraMm / 2;
  const metal = "#b8bcc4";
  const metalEscuro = "#8b909b";
  const vidro = "#9fb8cc";

  if (souReboque) {
    const eixo1 = meio - larguraMm * 0.32;
    const eixo2 = meio + larguraMm * 0.32;
    const raioRoda = Math.min(larguraMm * 0.12, 220);
    return (
      <G opacity={0.85}>
        <Rect x={-1500} y={meio - 45} width={1180} height={90} rx={40} fill={metal} />
        <Circle cx={-1460} cy={meio} r={70} fill="none" stroke={metalEscuro} strokeWidth={22} />
        <Rect x={-420} y={40} width={420} height={larguraMm - 80} rx={24} fill={metal} />
        {[eixo1, eixo2].map((cy) => (
          <React.Fragment key={cy}>
            <Circle cx={-260} cy={cy} r={raioRoda} fill={metalEscuro} />
            <Circle cx={-140} cy={cy} r={raioRoda} fill={metalEscuro} />
          </React.Fragment>
        ))}
      </G>
    );
  }

  return (
    <G opacity={0.85}>
      <Rect x={-1900} y={60} width={1750} height={larguraMm - 120} rx={220} fill={metal} />
      <Rect x={-380} y={140} width={260} height={larguraMm - 280} rx={40} fill={vidro} />
      <Rect x={-260} y={-30} width={70} height={140} rx={20} fill={metalEscuro} />
      <Rect x={-260} y={larguraMm - 110} width={70} height={140} rx={20} fill={metalEscuro} />
      <Circle cx={-1500} cy={20} r={130} fill={metalEscuro} />
      <Circle cx={-1500} cy={larguraMm - 20} r={130} fill={metalEscuro} />
    </G>
  );
}

/** Documento PDF da planta de carga de um Carregamento — para dar ao motorista
 * e a quem carrega o camião. Mesma leitura visual do ecrã
 * (components/CarregamentoFloorPlan.tsx), em papel. */
export function PlantaCargaDocument({ detalhe }: { detalhe: CarregamentoDetalhe }) {
  const clientes: { id: number; nome: string }[] = [];
  const vistos = new Set<number>();
  for (const cx of detalhe.packing.caixas) {
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

  return (
    <Document title={`Planta de carga — ${detalhe.veiculo.nome}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.between}>
          <View>
            <Text style={styles.empresa}>{EMPRESA.nome}</Text>
            <Text style={styles.empresaSub}>{EMPRESA.detalhe}</Text>
          </View>
          <View style={styles.tituloBox}>
            <Text style={styles.titulo}>PLANTA DE CARGA</Text>
            <Text style={styles.meta}>
              {detalhe.veiculo.nome}
              {detalhe.veiculo.matricula ? ` (${detalhe.veiculo.matricula})` : ""}
              {detalhe.reboque ? ` + ${detalhe.reboque.nome}` : ""}
            </Text>
            <Text style={styles.meta}>Data: {fmtData(detalhe.data)}</Text>
          </View>
        </View>

        <View style={styles.sep} />

        {detalhe.packing.naoColocados.length > 0 && (
          <View style={styles.aviso}>
            <Text style={styles.avisoTitulo}>
              ⚠ {detalhe.packing.naoColocados.length} palete(s) não coube/couberam nesta configuração
            </Text>
            {detalhe.packing.naoColocados.map((n, i) => (
              <Text key={i} style={styles.avisoLinha}>
                {n.unidade.clienteNome} — {n.unidade.tipoPaleteNome}
                {n.motivo === "NAO_CABE_ORIENTACAO" ? " (não cabe em nenhuma orientação)" : " (sem espaço)"}
              </Text>
            ))}
          </View>
        )}

        {detalhe.packing.caixas.map((cx) => {
          const souReboque = cx.caixa.id.startsWith("reboque-");
          const frenteMm = espacoFrenteMm(souReboque);
          const comprimentoTotalMm = cx.caixa.comprimentoMm + frenteMm;
          const larguraPt = Math.min(
            LARGURA_DISPONIVEL_PT,
            ALTURA_MAX_CAIXA_PT * (comprimentoTotalMm / cx.caixa.larguraMm),
          );
          const alturaPt = larguraPt * (cx.caixa.larguraMm / comprimentoTotalMm);
          const pct = cx.areaTotalMm2 > 0 ? Math.round((cx.areaUsadaMm2 / cx.areaTotalMm2) * 100) : 0;
          return (
            <View key={cx.caixa.id} style={styles.caixaBloco} wrap={false}>
              <View style={styles.caixaHeader}>
                <Text style={styles.caixaLabel}>{cx.caixa.label}</Text>
                <Text style={styles.caixaMeta}>
                  ◄ Frente ({souReboque ? "engate" : "cabine"}) — {Math.round(cx.comprimentoUsadoMm)} /{" "}
                  {cx.caixa.comprimentoMm} mm — {pct}% ocupado — Portas ►
                </Text>
              </View>
              <Svg
                width={larguraPt}
                height={alturaPt}
                viewBox={`${-frenteMm} 0 ${comprimentoTotalMm} ${cx.caixa.larguraMm}`}
              >
                <DesenhoFrentePdf larguraMm={cx.caixa.larguraMm} souReboque={souReboque} />
                <Rect
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
                    const fontSize = Math.max(Math.min(item.larguraOcupada, item.comprimentoOcupado) / 7, 20);
                    // Sem suporte a truncar com elipse/overflow no SVG do react-pdf —
                    // corta o nome à mão quando manifestamente não cabe na largura.
                    const maxChars = Math.max(Math.floor(item.comprimentoOcupado / (fontSize * 0.55)), 3);
                    const nomeMostrado =
                      item.clienteNome.length > maxChars
                        ? `${item.clienteNome.slice(0, maxChars - 1)}…`
                        : item.clienteNome;
                    return (
                      <React.Fragment key={`${item.pedidoId}-${item.x}-${item.y}`}>
                        <Rect
                          x={item.y}
                          y={item.x}
                          width={item.comprimentoOcupado}
                          height={item.larguraOcupada}
                          rx={rx}
                          fill={corDoCliente(item.clienteId)}
                          stroke="#fff"
                          strokeWidth={6}
                        />
                        <Text
                          x={item.y + item.comprimentoOcupado / 2}
                          y={item.x + item.larguraOcupada / 2 + fontSize / 3}
                          style={{ fontSize, fill: "#fff", fontWeight: 600, textAnchor: "middle" }}
                        >
                          {nomeMostrado}
                        </Text>
                      </React.Fragment>
                    );
                  })}
              </Svg>
              <View style={styles.legenda}>
                {clientes.map((c, i) => (
                  <View key={c.id} style={styles.legendaItem}>
                    <View style={[styles.legendaSwatch, { backgroundColor: CORES_CATEGORICAS[i % CORES_CATEGORICAS.length] }]} />
                    <Text style={styles.legendaTexto}>{c.nome}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.th}>
          <Text style={styles.cOrdem}>Ordem</Text>
          <Text style={styles.cCliente}>Cliente</Text>
          <Text style={styles.cTipo}>Tipo de palete</Text>
          <Text style={styles.cQtd}>Quantidade</Text>
        </View>
        {detalhe.pedidos.map((p) => (
          <View style={styles.td} key={p.id} wrap={false}>
            <Text style={styles.cOrdem}>{p.ordem + 1}</Text>
            <Text style={styles.cCliente}>{p.clienteNome}</Text>
            <Text style={styles.cTipo}>{p.tipoPaleteNome}</Text>
            <Text style={styles.cQtd}>{p.quantidade}</Text>
          </View>
        ))}

        <Text style={styles.rodape} fixed>
          Planta de carga — documento operacional, gerado a partir do carregamento registado.
        </Text>
      </Page>
    </Document>
  );
}
