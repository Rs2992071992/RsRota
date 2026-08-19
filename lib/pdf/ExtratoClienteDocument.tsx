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
  between: { flexDirection: "row", justifyContent: "space-between" },
  empresa: { fontSize: 16, fontWeight: "bold" },
  empresaSub: { fontSize: 8, color: "#666", marginTop: 2, maxWidth: 240 },
  tituloBox: { alignItems: "flex-end" },
  titulo: { fontSize: 18, fontWeight: "bold", color: "#2b6cb0" },
  meta: { fontSize: 9, marginTop: 2 },
  sep: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 14 },
  secaoTitulo: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 4 },
  clienteNome: { fontSize: 11, fontWeight: "bold" },
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
  cRota: { width: "26%" },
  cData: { width: "18%", textAlign: "right" },
  cValor: { width: "18%", textAlign: "right" },
  cVence: { width: "20%", textAlign: "right" },
  cEstado: { width: "18%", textAlign: "right" },
  totais: { marginTop: 12, alignSelf: "flex-end", width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalFinal: {
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

export interface ExtratoClienteData {
  cliente: string;
  geradoEm: Date;
  /** Só as paragens por pagar deste cliente (ordenadas por vencimento, mais atrasado primeiro). */
  linhas: LinhaCobranca[];
}

/** Documento PDF "extrato de conta" de um cliente (A4) — pronto a enviar como cobrança. */
export function ExtratoClienteDocument({ dados }: { dados: ExtratoClienteData }) {
  const porReceber = dados.linhas.reduce((a, l) => a + l.valor, 0);
  const vencido = dados.linhas
    .filter((l) => l.estado === "VENCIDO")
    .reduce((a, l) => a + l.valor, 0);

  return (
    <Document title={`Extrato de conta — ${dados.cliente}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <View>
            <Text style={styles.empresa}>{EMPRESA.nome}</Text>
            <Text style={styles.empresaSub}>{EMPRESA.detalhe}</Text>
          </View>
          <View style={styles.tituloBox}>
            <Text style={styles.titulo}>EXTRATO DE CONTA</Text>
            <Text style={styles.meta}>Gerado em: {fmtData(dados.geradoEm)}</Text>
          </View>
        </View>

        <View style={styles.sep} />

        <View>
          <Text style={styles.secaoTitulo}>Cliente</Text>
          <Text style={styles.clienteNome}>{dados.cliente}</Text>
        </View>

        <View style={styles.sep} />

        {dados.linhas.length === 0 ? (
          <Text>Sem valores por receber deste cliente.</Text>
        ) : (
          <>
            <View style={styles.th}>
              <Text style={styles.cRota}>Rota</Text>
              <Text style={styles.cData}>Data</Text>
              <Text style={styles.cValor}>Valor</Text>
              <Text style={styles.cVence}>Vencimento</Text>
              <Text style={styles.cEstado}>Estado</Text>
            </View>
            {dados.linhas.map((l) => (
              <View style={styles.td} key={l.id} wrap={false}>
                <Text style={styles.cRota}>{l.idRota}</Text>
                <Text style={styles.cData}>{fmtData(l.data)}</Text>
                <Text style={styles.cValor}>{fmtEuro(l.valor)}</Text>
                <Text style={styles.cVence}>{fmtData(l.dataVencimento)}</Text>
                <Text style={styles.cEstado}>{ROTULO_ESTADO[l.estado]}</Text>
              </View>
            ))}

            <View style={styles.totais}>
              <View style={styles.totalRow}>
                <Text>Vencido (+90 d)</Text>
                <Text>{fmtEuro(vencido)}</Text>
              </View>
              <View style={styles.totalFinal}>
                <Text>TOTAL POR RECEBER</Text>
                <Text>{fmtEuro(porReceber)}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.rodape} fixed>
          Extrato de conta — {dados.cliente}. Valores em euros. Prazo de pagamento: 90 dias a
          contar da data de cada serviço.
        </Text>
      </Page>
    </Document>
  );
}
