import React from "react";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSessao } from "@/lib/session";
import { SEM_EMPRESA, carregarFolha, type FolhaMotorista } from "@/lib/folha-motorista-service";
import { FolhaMotoristaDocument, rotuloMes } from "@/lib/pdf/FolhaMotoristaDocument";

// @react-pdf precisa do runtime Node (não Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  formato: z.enum(["pdf", "xlsx"]).default("pdf"),
  de: data.optional(),
  ate: data.optional(),
  /** Nomes das empresas-mãe separados por vírgula (e/ou SEM_EMPRESA). */
  empresas: z.string().optional(),
  veiculoId: z.coerce.number().int().positive().optional(),
  preco: z.enum(["0", "1"]).default("0"),
});

const fmtDia = (iso: string) => iso.split("-").reverse().join("/");

function descreverFiltro(q: z.infer<typeof querySchema>, empresas: string[]): string {
  const partes: string[] = [];
  if (q.de || q.ate) partes.push(`Período: ${q.de ? fmtDia(q.de) : "início"} – ${q.ate ? fmtDia(q.ate) : "hoje"}`);
  if (empresas.length > 0) {
    partes.push(`Empresas: ${empresas.map((e) => (e === SEM_EMPRESA ? "Sem empresa atribuída" : e)).join(", ")}`);
  }
  return partes.join("  ·  ");
}

// Nome de folha Excel: máx. 31 caracteres e sem  []:*?/\
const nomeFolha = (s: string, usados: Set<string>) => {
  const base = s.replace(/[[\]:*?\\/]/g, "-").slice(0, 28) || "Folha";
  let nome = base;
  for (let i = 2; usados.has(nome); i++) nome = `${base.slice(0, 26)} ${i}`;
  usados.add(nome);
  return nome;
};

function paraExcel(folha: FolhaMotorista, incluirPreco: boolean): Uint8Array<ArrayBuffer> {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  const cab = ["Dia", "Empresa", "Km Iniciais", "Km Finais", "% da carga", "Gasóleo (L)", ...(incluirPreco ? ["Preço (€/L)"] : []), "Observações"];
  const arred = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

  if (folha.grupos.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sem paragens para os filtros escolhidos."]]), "Folha");
  }
  for (const g of folha.grupos) {
    const linhas = g.linhas.map((l) => [
      l.dia,
      l.empresa,
      Math.round(l.kmInicial),
      Math.round(l.kmFinal),
      l.pctCarga == null ? "" : Math.round(l.pctCarga),
      arred(l.litros, 1),
      ...(incluirPreco ? [arred(l.preco, 3)] : []),
      l.observacoes,
    ]);
    const totais = ["", "Total", "", Math.round(g.totalKm), "", arred(g.totalLitros, 1), ...(incluirPreco ? [""] : []), ""];
    const ws = XLSX.utils.aoa_to_sheet([
      ["Camião:", g.camiao],
      ["Mês:", rotuloMes(g.mes)],
      [],
      cab,
      ...linhas,
      totais,
      ...(folha.litrosEstimados
        ? [[], ["Gasóleo = litros estimados pelo sistema a partir dos km e da carga (não são abastecimentos registados)."]]
        : []),
    ]);
    ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, ...(incluirPreco ? [{ wch: 12 }] : []), { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws, nomeFolha(`${g.camiao} ${g.mes}`, usados));
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// GET /api/folha-motorista?formato=pdf|xlsx&de=&ate=&empresas=Tecfil,Blowtec&veiculoId=&preco=1
// Folha de registo do camião (só escritório).
export async function GET(req: Request) {
  if ((await getSessao()) !== "ESCRITORIO") {
    return new Response("Sem permissão.", { status: 403 });
  }
  const bruto = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse(bruto);
  if (!parsed.success) return new Response("Parâmetros inválidos.", { status: 400 });
  const q = parsed.data;
  const empresas = (q.empresas ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  const folha = await carregarFolha({ de: q.de, ate: q.ate, empresas, veiculoId: q.veiculoId });
  const incluirPreco = q.preco === "1";

  if (q.formato === "xlsx") {
    return new NextResponse(paraExcel(folha, incluirPreco), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="folha-registo.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const elemento = React.createElement(FolhaMotoristaDocument, {
    folha,
    incluirPreco,
    filtroDescricao: descreverFiltro(q, empresas),
    geradoEm: new Date(),
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="folha-registo.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
