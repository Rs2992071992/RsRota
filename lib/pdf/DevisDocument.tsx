import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { LinhaDevis } from "@/lib/calc/orcamento";

// Dados do prestador (transportadora). Editar aqui para personalizar o cabeçalho
// do PDF — propositadamente uma constante simples (não há tabela de empresa na BD).
const EMPRESA = {
  nome: "Transportes",
  detalhe: "Serviços de logística e transporte rodoviário de mercadorias",
  contacto: "",
};

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num0 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
const fmtEuro = (v: number) => eur.format(v || 0);
const fmtData = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-PT") : "—";

export interface DevisPdfData {
  numero: string;
  cliente: string;
  clienteEmail: string | null;
  clienteMorada: string | null;
  clienteContato: string | null;
  data: Date | string;
  validade: Date | string | null;
  linhas: LinhaDevis[];
  observacoes: string | null;
  ivaPercent: number;
  subtotal: number;
  ivaValor: number;
  total: number;
}

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
  secaoTitulo: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 4 },
  clienteNome: { fontSize: 11, fontWeight: "bold" },
  clienteLinha: { fontSize: 9, color: "#444", marginTop: 1 },
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
  cDesc: { width: "44%" },
  cKm: { width: "14%", textAlign: "right" },
  cPeso: { width: "16%", textAlign: "right" },
  cPreco: { width: "26%", textAlign: "right" },
  subLinha: { fontSize: 7, color: "#888", marginTop: 1 },
  totais: { marginTop: 12, alignSelf: "flex-end", width: "45%" },
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
  obs: { marginTop: 18 },
  obsTexto: { fontSize: 9, color: "#444", marginTop: 3 },
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

/** Documento PDF de um orçamento (A4). Componente @react-pdf — não renderiza no DOM. */
export function DevisDocument({ devis }: { devis: DevisPdfData }) {
  return (
    <Document title={`Orçamento ${devis.numero}`}>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.between}>
          <View>
            <Text style={styles.empresa}>{EMPRESA.nome}</Text>
            <Text style={styles.empresaSub}>{EMPRESA.detalhe}</Text>
            {EMPRESA.contacto ? (
              <Text style={styles.empresaSub}>{EMPRESA.contacto}</Text>
            ) : null}
          </View>
          <View style={styles.tituloBox}>
            <Text style={styles.titulo}>ORÇAMENTO</Text>
            <Text style={styles.meta}>Nº {devis.numero}</Text>
            <Text style={styles.meta}>Data: {fmtData(devis.data)}</Text>
            <Text style={styles.meta}>Válido até: {fmtData(devis.validade)}</Text>
          </View>
        </View>

        <View style={styles.sep} />

        {/* Cliente */}
        <View>
          <Text style={styles.secaoTitulo}>Cliente</Text>
          <Text style={styles.clienteNome}>{devis.cliente}</Text>
          {devis.clienteContato ? (
            <Text style={styles.clienteLinha}>A/C: {devis.clienteContato}</Text>
          ) : null}
          {devis.clienteMorada ? (
            <Text style={styles.clienteLinha}>{devis.clienteMorada}</Text>
          ) : null}
          {devis.clienteEmail ? (
            <Text style={styles.clienteLinha}>{devis.clienteEmail}</Text>
          ) : null}
        </View>

        <View style={styles.sep} />

        {/* Tabela de linhas */}
        <View style={styles.th}>
          <Text style={styles.cDesc}>Descrição</Text>
          <Text style={styles.cKm}>Km</Text>
          <Text style={styles.cPeso}>Peso (kg)</Text>
          <Text style={styles.cPreco}>Preço</Text>
        </View>
        {devis.linhas.map((l, i) => {
          const trajeto = [l.origem, l.destino].filter(Boolean).join(" → ");
          const desc = l.descricao || trajeto || "Transporte";
          return (
            <View style={styles.td} key={i} wrap={false}>
              <View style={styles.cDesc}>
                <Text>{desc}</Text>
                {l.descricao && trajeto ? (
                  <Text style={styles.subLinha}>{trajeto}</Text>
                ) : null}
                {l.idaVolta ? (
                  <Text style={styles.subLinha}>Ida e volta</Text>
                ) : null}
              </View>
              <Text style={styles.cKm}>{num0.format(l.km || 0)}</Text>
              <Text style={styles.cPeso}>{num0.format(l.pesoKg || 0)}</Text>
              <Text style={styles.cPreco}>{fmtEuro(l.preco)}</Text>
            </View>
          );
        })}

        {/* Totais */}
        <View style={styles.totais}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{fmtEuro(devis.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>IVA ({num0.format(devis.ivaPercent)}%)</Text>
            <Text>{fmtEuro(devis.ivaValor)}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text>TOTAL</Text>
            <Text>{fmtEuro(devis.total)}</Text>
          </View>
        </View>

        {/* Observações */}
        {devis.observacoes ? (
          <View style={styles.obs}>
            <Text style={styles.secaoTitulo}>Observações</Text>
            <Text style={styles.obsTexto}>{devis.observacoes}</Text>
          </View>
        ) : null}

        <Text style={styles.rodape} fixed>
          Orçamento {devis.numero} — preços em euros, IVA incluído no total. Valores
          estimados, sujeitos a confirmação.
        </Text>
      </Page>
    </Document>
  );
}
