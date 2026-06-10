import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { TIPOS_VEICULO } from "@/lib/validacao";

export const dynamic = "force-dynamic";

// Normaliza um cabeçalho para comparação (sem acentos, minúsculas).
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numOuNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = num(v);
  return n === 0 ? null : n;
};

function veiculoValido(v: unknown): string {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "RETORNO") return "VAZIO"; // RETORNO deixou de existir; equivalente a VAZIO.
  return (TIPOS_VEICULO as readonly string[]).includes(s) ? s : "CAMIAO";
}

// Converte um número de série do Excel numa data. Só aceita séries plausíveis
// (> 40000 ≈ ano 2009+) para ignorar a coluna "Dias da semana" (29, 30, ...).
function serieParaData(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isFinite(n) && n > 40000 && n < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  }
  return null;
}

// POST /api/importar — recebe o .xlsx e cria paragens a partir da folha Viagens_APP.
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("ficheiro");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Ficheiro em falta." }, { status: 400 });
  }

  // Valor por noite (para converter a coluna "Noites" do Excel, em euros, em contagem).
  const params = await prisma.parametros.findUnique({ where: { id: 1 } });
  const valorNoite = params?.valorNoite || 70;

  const buf = Buffer.from(await file.arrayBuffer());
  // Sem cellDates: lemos números crus (a coluna Peso tem formato de data no Excel,
  // que com cellDates seria erradamente convertido). As datas tratamos à mão.
  const wb = XLSX.read(buf, { type: "buffer" });

  const nomeFolha = wb.SheetNames.find((s) => norm(s).includes("viagens"));
  if (!nomeFolha) {
    return NextResponse.json(
      { erro: "Não encontrei a folha 'Viagens_APP' no ficheiro." },
      { status: 400 },
    );
  }
  const ws = wb.Sheets[nomeFolha];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  // Localiza a linha de cabeçalho (contém "ID Rota").
  const idxHeader = linhas.findIndex((l) => l.some((c) => norm(c) === "id rota"));
  if (idxHeader < 0) {
    return NextResponse.json({ erro: "Cabeçalho 'ID Rota' não encontrado." }, { status: 400 });
  }
  const header = linhas[idxHeader].map(norm);
  const col = (nome: string) => header.indexOf(norm(nome));

  const c = {
    idRota: col("ID Rota"),
    data: col("Dias da semana"),
    tipoViagem: col("IDA/VOLTA"),
    cliente: col("Cliente"),
    kmIn: col("KM IN"),
    kmFim: col("KM FIM"),
    kmFeitos: col("Km feitos"),
    peso: col("Peso Transportado"),
    precoRef: col("Preço ref combustivel"),
    zona: col("Zona Portagem"),
    portagensAdi: col("Portagens adi"),
    tipoVeiculo: col("Tipo viagem"),
    noites: col("Noites"),
    alimentacao: col("Alimentação"),
    horas: col("Horas a mais"),
    receita: col("Receita Paga pelo cliente"),
    litrosES: col("LitrosESPAHA"),
    custoES: col("CombsESPAHA"),
  };

  const fallbackData = new Date();
  let semData = 0;
  const registos: Parameters<typeof prisma.paragem.create>[0]["data"][] = [];

  for (let i = idxHeader + 1; i < linhas.length; i++) {
    const row = linhas[i];
    const idRota = String(row[c.idRota] ?? "").trim();
    if (!idRota) continue; // ignora linhas vazias

    const dataParsed = serieParaData(row[c.data]);
    const data = dataParsed ?? fallbackData;
    if (!dataParsed) semData++;

    // KM: usa KM IN/FIM se presentes; senão usa a coluna "Km feitos" (kmInicial=0).
    const kmIn = num(row[c.kmIn]);
    const kmFim = num(row[c.kmFim]);
    const kmFeitos = c.kmFeitos >= 0 ? num(row[c.kmFeitos]) : 0;
    const usaKmFeitos = kmIn === 0 && kmFim === 0 && kmFeitos > 0;

    registos.push({
      idRota,
      data,
      tipoViagem: String(row[c.tipoViagem] ?? "Ida").trim() === "Volta" ? "Volta" : "Ida",
      tipoVeiculo: veiculoValido(row[c.tipoVeiculo]),
      cliente: String(row[c.cliente] ?? "").trim() || "(sem cliente)",
      kmInicial: usaKmFeitos ? 0 : kmIn,
      kmFinal: usaKmFeitos ? kmFeitos : kmFim,
      // Peso transportado do Excel -> KG Carregados (max(carregados,descarregados) recupera-o).
      kgCarregados: num(row[c.peso]),
      kgDescarregados: 0,
      litrosAbastecidos: 0,
      custoAbastecido: 0,
      zonaPortagem: String(row[c.zona] ?? "").trim(),
      portagensExtra: num(row[c.portagensAdi]),
      // A coluna "Noites" do Excel está em euros; convertemos em nº de noites.
      noitesFora: Math.round(num(row[c.noites]) / valorNoite),
      alimentacao: num(row[c.alimentacao]),
      horasExtra: num(row[c.horas]),
      // Preço de referência do combustível por paragem (no Excel a coluna S varia
      // por linha: ex. 1,834 ou 1,83). Importado como override; se ausente, usa o global.
      precoCombRefOverride: c.precoRef >= 0 ? numOuNull(row[c.precoRef]) : null,
      receitaPaga: num(row[c.receita]),
      litrosEspanha: numOuNull(row[c.litrosES]),
      custoEspanha: numOuNull(row[c.custoES]),
    });
  }

  if (registos.length === 0) {
    return NextResponse.json({ erro: "Nenhuma linha válida encontrada." }, { status: 400 });
  }

  // Substitui os dados existentes pela importação (migração).
  await prisma.$transaction([
    prisma.paragem.deleteMany({}),
    prisma.paragem.createMany({ data: registos }),
  ]);

  return NextResponse.json({
    ok: true,
    folha: nomeFolha,
    inseridas: registos.length,
    semData,
  });
}
