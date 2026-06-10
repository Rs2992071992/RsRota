import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtData } from "@/lib/format";
import ApagarMotorista from "./ApagarMotorista";

export const dynamic = "force-dynamic";

export default async function MotoristasPage() {
  const motoristas = await prisma.utilizador.findMany({
    where: { perfil: "MOTORISTA" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      criadoEm: true,
      _count: { select: { paragens: true } },
    },
    orderBy: { criadoEm: "asc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Motoristas</h1>

      {motoristas.length === 0 ? (
        <div className="card text-sm text-gray-500">
          Ainda não há motoristas. Podem ser criados na página de login (botão “Criar motorista”).
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Nome</th>
                <th className="th">ID</th>
                <th className="th text-right">Paragens</th>
                <th className="th">Criado em</th>
                <th className="th text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {motoristas.map((m) => (
                <tr key={m.id}>
                  <td className="td font-medium">{m.nome || "—"}</td>
                  <td className="td">{m.codigo}</td>
                  <td className="td text-right">{m._count.paragens}</td>
                  <td className="td">{fmtData(m.criadoEm)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/escritorio/motoristas/${m.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        Ver rotas
                      </Link>
                      <ApagarMotorista id={m.id} nome={m.nome || m.codigo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
