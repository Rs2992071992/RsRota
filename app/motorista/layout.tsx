import Link from "next/link";
import { LogOut, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigirPerfil, getSessaoInfo } from "@/lib/session";
import Calculadora from "@/components/Calculadora";
import LinkPrecoReferencia from "@/components/LinkPrecoReferencia";

export const dynamic = "force-dynamic";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  await exigirPerfil("MOTORISTA");
  const sessao = await getSessaoInfo();
  const user =
    sessao?.perfil === "MOTORISTA"
      ? await prisma.utilizador.findUnique({ where: { id: sessao.id } })
      : null;
  const nome = user?.nome || user?.codigo || "Motorista";
  const tarefasPendentes =
    sessao?.perfil === "MOTORISTA"
      ? await prisma.tarefa.count({ where: { motoristaId: sessao.id, concluida: false } })
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-brand">
              <Truck size={20} strokeWidth={2} />
              {nome}
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700">
                <LogOut size={16} strokeWidth={2} />
                Sair
              </button>
            </form>
          </div>
          <nav className="mt-2 flex flex-wrap gap-1">
            <Link
              href="/motorista/registo"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Registar
            </Link>
            <Link
              href="/motorista/historico"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Histórico
            </Link>
            <Link
              href="/motorista/avarias"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Ped. Manutenção
            </Link>
            <Link
              href="/motorista/tarefas"
              className="relative rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Tarefas
              {tarefasPendentes > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                  {tarefasPendentes}
                </span>
              )}
            </Link>
            <Link
              href="/motorista/perfil"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Perfil
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">{children}</main>
      <LinkPrecoReferencia />
      <Calculadora />
    </div>
  );
}
