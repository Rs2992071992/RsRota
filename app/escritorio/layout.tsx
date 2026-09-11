import Image from "next/image";
import { LogOut } from "lucide-react";
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
  await exigirPerfil("ESCRITORIO");
  const vencidos = await contarVencidos();
  return (
    <div className="min-h-screen">
      <header className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            {/* Fonte é 600x537px/604KB — `next/image` gera uma versão otimizada
                (WebP/AVIF, dimensionada ao tamanho real exibido) em vez de
                servir o PNG original em todas as páginas do escritório. */}
            <Image
              src="/logo-manager.png"
              alt="RsRota Manager"
              width={150}
              height={134}
              priority
              className="h-14 w-auto rounded-lg py-1"
            />
            <NavLinks vencidos={vencidos} />
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700">
              <LogOut size={16} strokeWidth={2} />
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      <Calculadora />
    </div>
  );
}
