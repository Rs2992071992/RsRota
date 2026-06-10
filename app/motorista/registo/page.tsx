import { prisma } from "@/lib/db";
import RegistoForm from "./RegistoForm";

export const dynamic = "force-dynamic";

export default async function RegistoPage({
  searchParams,
}: {
  searchParams: { idRota?: string; tipoVeiculo?: string; kmInicial?: string };
}) {
  const [portagens, params, rotasRecentes, veiculos] = await Promise.all([
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.paragem.findMany({
      select: { idRota: true },
      distinct: ["idRota"],
      orderBy: { data: "desc" },
      take: 15,
    }),
    prisma.veiculo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true, capacidadeCamiao: true, capacidadeReboque: true },
    }),
  ]);

  // Pré-preenchimento vindo do "Continuar rota" (histórico).
  const inicial = {
    idRota: searchParams.idRota ?? "",
    tipoVeiculo: searchParams.tipoVeiculo ?? "",
    kmInicial: searchParams.kmInicial ?? "",
  };

  return (
    <RegistoForm
      zonas={portagens.map((p) => p.zona)}
      veiculos={veiculos}
      capacidadeCamiao={params?.capacidadeCamiao ?? 14000}
      capacidadeReboque={params?.capacidadeReboque ?? 24000}
      valorNoite={params?.valorNoite ?? 70}
      rotasRecentes={rotasRecentes.map((r) => r.idRota)}
      inicial={inicial}
    />
  );
}
