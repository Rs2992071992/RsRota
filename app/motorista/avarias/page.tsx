import { prisma } from "@/lib/db";
import AvariaForm from "./AvariaForm";

export const dynamic = "force-dynamic";

export default async function AvariasPage() {
  const [veiculos, avariasPendentes] = await Promise.all([
    prisma.veiculo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true },
    }),
    prisma.avaria.findMany({
      where: { resolvida: false },
      orderBy: { data: "desc" },
      select: { id: true, veiculoId: true, data: true, descricao: true },
    }),
  ]);

  return (
    <AvariaForm
      veiculos={veiculos}
      avariasPendentes={avariasPendentes.map((a) => ({
        ...a,
        data: a.data.toISOString(),
      }))}
    />
  );
}
