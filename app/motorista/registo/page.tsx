import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import RegistoForm from "./RegistoForm";

export const dynamic = "force-dynamic";

export default async function RegistoPage({
  searchParams,
}: {
  searchParams: { idRota?: string; tipoVeiculo?: string; kmInicial?: string };
}) {
  // O motorista só vê para continuar as SUAS próprias rotas; o escritório vê todas.
  const sessao = getSessaoInfo();
  const filtroRotas = sessao?.perfil === "MOTORISTA" ? { motoristaId: sessao.id } : {};

  const [portagens, params, rotasRecentes, veiculos, clientesParagens, clientesFicha, paragensRotaAtiva] =
    await Promise.all([
      prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
      prisma.parametros.findUnique({ where: { id: 1 } }),
      prisma.paragem.findMany({
        where: filtroRotas,
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
      // Clientes já usados (sugestões da lista predefinida) + fichas de contacto.
      prisma.paragem.findMany({ select: { cliente: true }, distinct: ["cliente"] }),
      prisma.cliente.findMany({ select: { nome: true } }),
      // Rota vinda de "Continuar rota" (histórico): pré-carrega o que já foi
      // introduzido para o resumo de noites/alimentação nascer preenchido.
      searchParams.idRota
        ? prisma.paragem.findMany({
            where: { ...filtroRotas, idRota: searchParams.idRota },
            select: {
              cliente: true,
              zonaPortagem: true,
              portagensExtra: true,
              noitesFora: true,
              alimentacao: true,
            },
            orderBy: { id: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const clientes = Array.from(
    new Set([...clientesParagens.map((p) => p.cliente), ...clientesFicha.map((c) => c.nome)]),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt"));

  // Pré-preenchimento vindo do "Continuar rota" (histórico).
  const inicial = {
    idRota: searchParams.idRota ?? "",
    tipoVeiculo: searchParams.tipoVeiculo ?? "",
    kmInicial: searchParams.kmInicial ?? "",
  };

  return (
    <RegistoForm
      zonas={portagens.map((p) => p.zona)}
      veiculos={veiculos.map((v) => ({
        ...v,
        dataLimiteInspecao: v.dataLimiteInspecao ? v.dataLimiteInspecao.toISOString() : null,
      }))}
      capacidadeCamiao={params?.capacidadeCamiao ?? 14000}
      capacidadeReboque={params?.capacidadeReboque ?? 24000}
      capacidadePaleteA={params?.capacidadePaleteA ?? 38}
      capacidadePaleteB={params?.capacidadePaleteB ?? 28}
      capacidadePaleteACamiao={params?.capacidadePaleteACamiao ?? 18}
      capacidadePaleteBCamiao={params?.capacidadePaleteBCamiao ?? 14}
      valorNoite={params?.valorNoite ?? 70}
      rotasRecentes={rotasRecentes.map((r) => r.idRota)}
      clientes={clientes}
      inicial={inicial}
      paragensRotaIniciais={paragensRotaAtiva}
    />
  );
}
