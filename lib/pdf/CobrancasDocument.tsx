import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/pdf/empresa";
import type { LinhaCobranca } from "@/lib/cobrancas-service";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtEuro = (v: number) => eur.format(v || 0);
const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-PT");

const ROTULO_ESTADO: Record<LinhaCobranca["estado"], string> = {
  PAGO: "Pago",
  A_AGUARDAR: "A aguardar",
  VENCIDO: "Vencido",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1a202c", fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  empresa: { fontSize: 16, fontWeight: "bold" },
  empresaSub: { fontSize: 8, color: "#666", marginTop: 2, maxWidth: 240 },
  tituloBox: { alignItems: "flex-end" },
  titulo: { fontSize: 18, fontWeight: "bold", color: "#2b6cb0" },
  meta: { fontSize: 9, marginTop: 2 },
  sep: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 14 },
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
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  cRota: { width: "20%" },
  cCliente: { width: "30%" },
  cData: { width: "14%", textAlign: "right" },
  cValor: { width: "16%", textAlign: "right" },
  cVence: { width: "20%", textAlign: "right" },
  resumo: { marginTop: 14, alignSelf: "flex-end", width: "50%" },
  resumoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  resumoFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e0",
    fontWeight: "bold",
    fontSize: 11,
  },
  rodape: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
  },
});

/** Documento PDF da tabela "Contas a receber" inteira (A4, uso interno). */
export function CobrancasDocument({ linhas, geradoEm }: { linhas: LinhaCobranca[]; geradoEm: Date }) {
  const porReceber = linhas.filter((l) => !l.pago).reduce((a, l) => a + l.valor, 0);
  const vencido = linhas.filter((l) => l.estado === "VENCIDO").reduce((a, l) => a + l.valor, 0);

  return (
    <Document title="Contas a receber">
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <View>
            <Text style={styles.empresa}>{EMPRESA.nome}</Text>
            <Text style={styles.empresaSub}>{EMPRESA.detalhe}</Text>
          </View>
          <View style={styles.tituloBox}>
            <Text style={styles.titulo}>CONTAS A RECEBER</Text>
            <Text style={styles.meta}>Gerado em: {fmtData(geradoEm)}</Text>
          </View>
        </View>

        <View style={styles.sep} />

        <View style={styles.th}>
          <Text style={styles.cRota}>Rota</Text>
          <Text style={styles.cCliente}>Cliente</Text>
          <Text style={styles.cData}>Data</Text>
          <Text style={styles.cValor}>Valor</Text>
          <Text style={styles.cVence}>Vencimento / Estado</Text>
        </View>
        {linhas.map((l) => (
          <View style={styles.td} key={l.id} wrap={false}>
            <Text style={styles.cRota}>{l.idRota}</Text>
            <Text style={styles.cCliente}>{l.cliente}</Text>
            <Text style={styles.cData}>{fmtData(l.data)}</Text>
            <Text style={styles.cValor}>{fmtEuro(l.valor)}</Text>
            <Text style={styles.cVence}>
              {fmtData(l.dataVencimento)} — {ROTULO_ESTADO[l.estado]}
            </Text>
          </View>
        ))}

        <View style={styles.resumo}>
          <View style={styles.resumoRow}>
            <Text>Por receber (total)</Text>
            <Text>{fmtEuro(porReceber)}</Text>
          </View>
          <View style={styles.resumoFinal}>
            <Text>Vencido (+90 d)</Text>
            <Text>{fmtEuro(vencido)}</Text>
          </View>
        </View>

        <Text style={styles.rodape} fixed>
          Contas a receber — documento interno, gerado a partir das paragens registadas.
        </Text>
      </Page>
    </Document>
  );
}
