import Link from "next/link";
import { LogOut } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigirPerfil, getSessaoInfo } from "@/lib/session";
import Calculadora from "@/components/Calculadora";

export const dynamic = "force-dynamic";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  exigirPerfil("MOTORISTA");
  const sessao = getSessaoInfo();
  const user =
    sessao?.perfil === "MOTORISTA"
      ? await prisma.utilizador.findUnique({ where: { id: sessao.id } })
      : null;
  const nome = user?.nome || user?.codigo || "Motorista";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-brand">🚚 {nome}</span>
            <form action="/api/auth/logout" method="post">
              <button className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700">
                <LogOut size={16} strokeWidth={2} />
                Sair
              </button>
            </form>
          </div>
          <nav className="mt-2 flex gap-1">
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
              href="/motorista/perfil"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Perfil
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">{children}</main>
      <Calculadora />
    </div>
  );
}
