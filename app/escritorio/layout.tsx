import { exigirPerfil } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PRAZO_DIAS } from "@/lib/calc/pagamentos";
import Calculadora from "@/components/Calculadora";
import NavLinks from "./NavLinks";

/** Conta paragens vencidas: não pagas, com valor, e cuja data + 90 dias já passou. */
async function contarVencidos(): Promise<number> {
  const limite = new Date(Date.now() - PRAZO_DIAS * 24 * 60 * 60 * 1000);
  return prisma.paragem.count({
    where: { pago: false, receitaPaga: { gt: 0 }, data: { lt: limite } },
  });
}

export default async function EscritorioLayout({ children }: { children: React.ReactNode }) {
  exigirPerfil("ESCRITORIO");
  const vencidos = await contarVencidos();
  return (
    <div className="min-h-screen">
      <header className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-brand">Gestão de Rotas</span>
            <NavLinks vencidos={vencidos} />
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-gray-500 hover:text-gray-800">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      <Calculadora />
    </div>
  );
}
