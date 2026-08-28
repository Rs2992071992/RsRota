import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { paragemSchema } from "@/lib/validacao";
import { snapshotParaRegisto } from "@/lib/snapshot-service";
import { iniciais, gerarIdRota } from "@/lib/rota-id";
import { resolverPaleteDimensoes } from "@/lib/rotas-service";

// POST /api/paragens — cria uma paragem (motorista ou escritório).
export async function POST(req: Request) {
  const sessao = getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = paragemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Congela o snapshot de custos (motorista + veículo usados) no momento do registo.
  const motoristaId = sessao.perfil === "MOTORISTA" ? sessao.id : null;
  const veiculoId = d.veiculoId ?? null;

  // ID da rota: se vier preenchido, é "continuar rota" -> reutiliza tal como está.
  // Se vier vazio, é uma rota nova -> gera `INICIAIS-Cliente` (único) a partir do condutor.
  let idRota = d.idRota?.trim() ?? "";
  if (!idRota) {
    const user = await prisma.utilizador.findUnique({
      where: { id: sessao.id },
      select: { nome: true, codigo: true },
    });
    idRota = await gerarIdRota(iniciais(user?.nome, user?.codigo ?? "ROTA"), d.cliente);
  }

  const [snapshot, paleteDimensoes] = await Promise.all([
    snapshotParaRegisto(motoristaId, veiculoId),
    resolverPaleteDimensoes(d.tipoPaleteId),
  ]);

  const criada = await prisma.paragem.create({
    data: {
      // Carimba o motorista que registou (escritório fica também associado à sua conta).
      motoristaId,
      veiculoId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      idRota,
      data: new Date(d.data),
      tipoViagem: d.tipoViagem,
      tipoVeiculo: d.tipoVeiculo,
      cliente: d.cliente,
      kmInicial: d.kmInicial,
      kmFinal: d.kmFinal,
      kgCarregados: d.kgCarregados,
      kgDescarregados: d.kgDescarregados,
      volume: d.volume,
      tipoPalete: d.volume ? (d.tipoPalete ?? null) : null,
      nPaletes: d.nPaletes,
      nMeiasPaletes: d.nMeiasPaletes,
      tipoPaleteId: d.tipoPaleteId ?? null,
      ...paleteDimensoes,
      pesoAproximado: d.pesoAproximado ?? null,
      litrosAbastecidos: d.litrosAbastecidos,
      custoAbastecido: d.custoAbastecido,
      zonaPortagem: d.zonaPortagem,
      portagensExtra: d.portagensExtra,
      noitesFora: d.noitesFora,
      alimentacao: d.alimentacao,
      horasExtra: d.horasExtra,
      recolha: d.recolha,
      faturarCliente: d.faturarCliente?.trim() || null,
      precoCombRefOverride: d.precoCombRefOverride ?? null,
      receitaPaga: d.receitaPaga,
      litrosEspanha: d.litrosEspanha ?? null,
      custoEspanha: d.custoEspanha ?? null,
    },
  });

  return NextResponse.json({ ok: true, paragem: criada }, { status: 201 });
}

// GET /api/paragens — lista completa (só escritório) ou, para o motorista,
// as suas próprias paragens: de UMA rota (?idRota=, usado no registo para
// mostrar o que já foi introduzido nessa rota e evitar duplicar noites/
// alimentação) ou, sem esse parâmetro, TODAS as suas paragens (mesma query
// que app/motorista/historico/page.tsx já faz server-side — usado por
// clientes que não podem renderizar no servidor, ex. app nativa).
export async function GET(req: Request) {
  const sessao = getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  if (sessao.perfil === "ESCRITORIO") {
    const paragens = await prisma.paragem.findMany({ orderBy: { data: "desc" } });
    return NextResponse.json({ paragens });
  }

  const idRota = new URL(req.url).searchParams.get("idRota");
  const paragens = await prisma.paragem.findMany({
    where: idRota ? { motoristaId: sessao.id, idRota } : { motoristaId: sessao.id },
    orderBy: idRota ? { id: "asc" } : [{ data: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ paragens });
}
