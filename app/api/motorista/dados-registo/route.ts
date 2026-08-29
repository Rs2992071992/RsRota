import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";

// GET /api/motorista/dados-registo — dados de referência para o registo de
// paragens (só motorista): zonas de portagem, veículos ativos (só os campos
// que o picker precisa, sem custos), clientes, rotas recentes do próprio
// motorista e o subconjunto de Parametros relevante. Junta numa só chamada
// o que app/motorista/registo/page.tsx já carrega server-side hoje — usado
// por clientes que não podem renderizar no servidor (ex. app nativa).
export async function GET() {
  const sessao = await getSessaoInfo();
  if (!sessao || sessao.perfil !== "MOTORISTA") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const [portagens, params, rotasRecentes, veiculos, clientesParagens, clientesFicha] =
    await Promise.all([
      prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
      prisma.parametros.findUnique({ where: { id: 1 } }),
      prisma.paragem.findMany({
        where: { motoristaId: sessao.id },
        select: { idRota: true },
        distinct: ["idRota"],
        orderBy: { data: "desc" },
        take: 15,
      }),
      prisma.veiculo.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          matricula: true,
          capacidadeCamiao: true,
          capacidadeReboque: true,
          capacidadePaleteA: true,
          capacidadePaleteB: true,
          capacidadePaleteACamiao: true,
          capacidadePaleteBCamiao: true,
          dataLimiteInspecao: true,
          inspecaoVerificada: true,
        },
      }),
      prisma.paragem.findMany({ select: { cliente: true }, distinct: ["cliente"] }),
      prisma.cliente.findMany({ select: { nome: true } }),
    ]);

  const clientes = Array.from(
    new Set([...clientesParagens.map((p) => p.cliente), ...clientesFicha.map((c) => c.nome)]),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt"));

  return NextResponse.json({
    zonas: portagens.map((p) => p.zona),
    veiculos: veiculos.map((v) => ({
      ...v,
      dataLimiteInspecao: v.dataLimiteInspecao ? v.dataLimiteInspecao.toISOString() : null,
    })),
    clientes,
    rotasRecentes: rotasRecentes.map((r) => r.idRota),
    parametros: {
      capacidadeCamiao: params?.capacidadeCamiao ?? 14000,
      capacidadeReboque: params?.capacidadeReboque ?? 24000,
      capacidadePaleteA: params?.capacidadePaleteA ?? 38,
      capacidadePaleteB: params?.capacidadePaleteB ?? 28,
      capacidadePaleteACamiao: params?.capacidadePaleteACamiao ?? 18,
      capacidadePaleteBCamiao: params?.capacidadePaleteBCamiao ?? 14,
      valorNoite: params?.valorNoite ?? 70,
    },
  });
}
