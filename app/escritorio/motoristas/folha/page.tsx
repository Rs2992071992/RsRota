import Link from "next/link";
import { prisma } from "@/lib/db";
import { listarEmpresas } from "@/lib/empresas-service";
import FolhaForm from "./FolhaForm";

export const dynamic = "force-dynamic";

export default async function FolhaRegistoPage() {
  const [empresas, veiculos] = await Promise.all([
    listarEmpresas(),
    prisma.veiculo.findMany({
      where: { categoria: "PESADO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  // Por defeito: o mês atual.
  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/escritorio/motoristas" className="text-sm text-gray-500 hover:underline">
          ← Motoristas
        </Link>
        <h1 className="text-2xl font-bold">Folha de registo do camião</h1>
        <p className="text-sm text-gray-500">
          Gera a folha (Dia, Empresa, Km, % da carga, Gasóleo…) a partir das paragens registadas pelos motoristas,
          em PDF ou Excel — um camião e um mês por página.
        </p>
      </div>
      <FolhaForm
        empresas={empresas.map((e) => e.nome)}
        veiculos={veiculos}
        deInicial={iso(new Date(Date.UTC(ano, mes, 1)))}
        ateInicial={iso(new Date(Date.UTC(ano, mes + 1, 0)))}
      />
    </div>
  );
}
