import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FolhaMotorista, GrupoFolha } from "@/lib/folha-motorista-service";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-10" → "Outubro 2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${ano}`;
}

const num0 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num3 = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const BORDA = "#1f2d3d";

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 42, paddingHorizontal: 30, fontSize: 9, color: "#111", fontFamily: "Helvetica" },
  cab: { fontSize: 11, marginBottom: 2 },
  cabValor: { fontWeight: "bold" },
  filtro: { fontSize: 8, color: "#555", marginBottom: 8 },
  tabela: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDA },
  linha: { flexDirection: "row" },
  celula: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDA,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 20,
    justifyContent: "center",
  },
  th: { fontWeight: "bold", textAlign: "center" },
  thCelula: { backgroundColor: "#eef2f7" },
  centro: { textAlign: "center" },
  direita: { textAlign: "right" },
  totais: { fontWeight: "bold", backgroundColor: "#f6f8fb" },
  nota: { marginTop: 8, fontSize: 7.5, color: "#555" },
  rodape: { position: "absolute", bottom: 18, left: 30, right: 30, fontSize: 7, color: "#999", textAlign: "center" },
});

interface Coluna {
  chave: string;
  titulo: string;
  largura: string;
  alinhar: "centro" | "direita" | "esquerda";
}

function colunas(comPreco: boolean): Coluna[] {
  const base: Coluna[] = [
    { chave: "dia", titulo: "Dia", largura: "5%", alinhar: "centro" },
    { chave: "empresa", titulo: "Empresa", largura: "22%", alinhar: "esquerda" },
    { chave: "kmInicial", titulo: "Km Iniciais", largura: "10%", alinhar: "direita" },
    { chave: "kmFinal", titulo: "Km Finais", largura: "10%", alinhar: "direita" },
    { chave: "kmPercorridos", titulo: "Km Percorridos", largura: "10%", alinhar: "direita" },
    { chave: "pct", titulo: "% da carga", largura: "8%", alinhar: "centro" },
    { chave: "litros", titulo: "Gasóleo (L)", largura: "9%", alinhar: "direita" },
  ];
  if (comPreco) base.push({ chave: "preco", titulo: "Preço (€/L)", largura: "8%", alinhar: "direita" });
  base.push({ chave: "obs", titulo: "Observações", largura: comPreco ? "18%" : "26%", alinhar: "esquerda" });
  return base;
}

function valorDe(g: GrupoFolha, i: number, chave: string): string {
  const l = g.linhas[i];
  switch (chave) {
    case "dia":
      return String(l.dia);
    case "empresa":
      return l.empresa;
    case "kmInicial":
      return num0.format(l.kmInicial);
    case "kmFinal":
      return num0.format(l.kmFinal);
    case "kmPercorridos":
      return num0.format(l.kmPercorridos);
    case "pct":
      return l.pctCarga == null ? "—" : `${num0.format(l.pctCarga)} %`;
    case "litros":
      return num1.format(l.litros);
    case "preco":
      return num3.format(l.preco);
    default:
      return l.observacoes;
  }
}

const estiloAlinhar = (a: Coluna["alinhar"]) => (a === "centro" ? styles.centro : a === "direita" ? styles.direita : undefined);

/**
 * Folha de registo do camião (A4 horizontal): uma secção por camião e mês,
 * com o mesmo desenho da folha em papel — Camião / Mês, e a tabela Dia,
 * Empresa, Km Iniciais, Km Finais, % da carga, Gasóleo (L), [Preço],
 * Observações. A linha de totais fecha cada secção.
 */
export function FolhaMotoristaDocument({
  folha,
  incluirPreco,
  filtroDescricao,
  geradoEm,
}: {
  folha: FolhaMotorista;
  incluirPreco: boolean;
  /** Texto do filtro aplicado (período / empresas), mostrado por baixo do cabeçalho. */
  filtroDescricao: string;
  geradoEm: Date;
}) {
  const cols = colunas(incluirPreco);
  return (
    <Document title="Folha de registo do camião">
      {folha.grupos.length === 0 ? (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.cab}>Sem paragens para os filtros escolhidos.</Text>
          <Text style={styles.filtro}>{filtroDescricao}</Text>
        </Page>
      ) : (
        folha.grupos.map((g) => (
          <Page key={`${g.camiao}|${g.mes}`} size="A4" orientation="landscape" style={styles.page}>
            <Text style={styles.cab}>
              Camião: <Text style={styles.cabValor}>{g.camiao}</Text>
            </Text>
            <Text style={styles.cab}>
              Mês: <Text style={styles.cabValor}>{rotuloMes(g.mes)}</Text>
            </Text>
            <Text style={styles.filtro}>{filtroDescricao}</Text>

            <View style={styles.tabela}>
              <View style={styles.linha} fixed>
                {cols.map((c) => (
                  <View key={c.chave} style={[styles.celula, styles.thCelula, { width: c.largura }]}>
                    <Text style={styles.th}>{c.titulo}</Text>
                  </View>
                ))}
              </View>
              {g.linhas.map((_, i) => (
                <View key={i} style={styles.linha} wrap={false}>
                  {cols.map((c) => (
                    <View key={c.chave} style={[styles.celula, { width: c.largura }]}>
                      <Text style={estiloAlinhar(c.alinhar)}>{valorDe(g, i, c.chave)}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={styles.linha} wrap={false}>
                {cols.map((c) => (
                  <View key={c.chave} style={[styles.celula, { width: c.largura }, styles.totais]}>
                    <Text style={estiloAlinhar(c.alinhar)}>
                      {c.chave === "empresa"
                        ? "Total"
                        : c.chave === "kmPercorridos"
                          ? num0.format(g.totalKm)
                          : c.chave === "litros"
                            ? num1.format(g.totalLitros)
                            : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.nota}>
              % da carga = ocupação do camião (e reboque, quando atrelado) ao chegar a cada paragem, segundo a planta
              de carga.
              {folha.litrosEstimados
                ? " Gasóleo = litros estimados pelo sistema a partir dos km e da carga (não são abastecimentos registados)."
                : ""}
            </Text>
            <Text style={styles.rodape} fixed>
              Folha de registo — gerada em {geradoEm.toLocaleDateString("pt-PT")}
            </Text>
          </Page>
        ))
      )}
    </Document>
  );
}
