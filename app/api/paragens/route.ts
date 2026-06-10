import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessao, getSessaoInfo } from "@/lib/session";
import { paragemSchema } from "@/lib/validacao";
import { snapshotParaRegisto } from "@/lib/snapshot-service";

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
  const snapshot = await snapshotParaRegisto(motoristaId, veiculoId);

  const criada = await prisma.paragem.create({
    data: {
      // Carimba o motorista que registou (escritório fica também associado à sua conta).
      motoristaId,
      veiculoId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      idRota: d.idRota,
      data: new Date(d.data),
      tipoViagem: d.tipoViagem,
      tipoVeiculo: d.tipoVeiculo,
      cliente: d.cliente,
      kmInicial: d.kmInicial,
      kmFinal: d.kmFinal,
      kgCarregados: d.kgCarregados,
      kgDescarregados: d.kgDescarregados,
      litrosAbastecidos: d.litrosAbastecidos,
      custoAbastecido: d.custoAbastecido,
      zonaPortagem: d.zonaPortagem,
      portagensExtra: d.portagensExtra,
      noitesFora: d.noitesFora,
      alimentacao: d.alimentacao,
      horasExtra: d.horasExtra,
      precoCombRefOverride: d.precoCombRefOverride ?? null,
      receitaPaga: d.receitaPaga,
      litrosEspanha: d.litrosEspanha ?? null,
      custoEspanha: d.custoEspanha ?? null,
    },
  });

  return NextResponse.json({ ok: true, paragem: criada }, { status: 201 });
}

// GET /api/paragens — lista (só escritório).
export async function GET() {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const paragens = await prisma.paragem.findMany({ orderBy: { data: "desc" } });
  return NextResponse.json({ paragens });
}
