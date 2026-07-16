import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessao } from "@/lib/session";
import { carregarRotas } from "@/lib/rotas-service";

export const dynamic = "force-dynamic";

// GET /api/exportar?formato=xlsx|csv — exporta rotas e paragens calculadas.
export async function GET(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const formato = new URL(req.url).searchParams.get("formato") ?? "xlsx";
  const rotas = await carregarRotas();

  // Folha Rotas (resumo)
  const linhasRotas = rotas.map((r) => ({
    "ID Rota": r.idRota,
    "Nº Paragens": r.paragens.length,
    "KM Totais": round(r.kmTotais),
    "Custo Total": round(r.custoTotalRota),
    "Preço Mínimo": round(r.precoMinimo),
    "Receita Total": round(r.receitaTotal),
    Lucro: round(r.lucro),
    Alerta: r.alerta,
  }));

  // Folha Paragens (detalhe calculado)
  const linhasParagens = rotas.flatMap((r) =>
    r.paragens.map((p) => ({
      "ID Rota": r.idRota,
      Cliente: p.cliente,
      Veículo: p.tipoVeiculo,
      "KM Feitos": round(p.kmFeitos),
      "Peso (kg)": round(p.pesoTransportado),
      "Nº Paletes": round(p.nPaletes),
      "Coef. Carga": p.coeficienteCarga === "Volume" ? "Volume" : round(p.coeficienteCarga * 100),
      "Consumo L/100": round(p.consumoL100),
      "Litros Gastos": round(p.litrosGastos),
      "Custo Combustível": round(p.custoCombustivel),
      "Custo Motorista": round(p.custoMotorista),
      "Custo Veículo": round(p.custoVeiculo),
      "Custo AdBlue": round(p.custoAdblue),
      "Portagens Extra": round(p.portagensExtra),
      "Custo Paragem": round(p.custoParagem),
      "€/kg": round(p.precoPorKg),
      "Poupança Espanha": round(p.poupancaEspanha),
    })),
  );

  if (formato === "csv") {
    const ws = XLSX.utils.json_to_sheet(linhasRotas);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rotas.csv"`,
      },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasRotas), "Rotas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasParagens), "Paragens");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rotas_export.xlsx"`,
    },
  });
}

const round = (v: number) => Math.round((v || 0) * 100) / 100;
