import Link from "next/link";
import {
  LayoutDashboard,
  Route,
  Users,
  FileText,
  Euro,
  IdCard,
  Truck,
  Settings,
  Upload,
} from "lucide-react";
import { exigirPerfil } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PRAZO_DIAS } from "@/lib/calc/pagamentos";
import Calculadora from "@/components/Calculadora";

const navItems = [
  { href: "/escritorio/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/escritorio/rotas", label: "Rotas", icon: Route },
  { href: "/escritorio/clientes", label: "Clientes", icon: Users },
  { href: "/escritorio/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/escritorio/cobrancas", label: "Cobranças", icon: Euro },
  { href: "/escritorio/motoristas", label: "Motoristas", icon: IdCard },
  { href: "/escritorio/veiculos", label: "Veículos", icon: Truck },
  { href: "/escritorio/parametros", label: "Parâmetros", icon: Settings },
  { href: "/escritorio/importar", label: "Importar", icon: Upload },
];

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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-brand">Gestão de Rotas</span>
            <nav className="flex gap-1">
              {navItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <it.icon size={18} strokeWidth={1.75} />
                  <span>{it.label}</span>
                  {it.href === "/escritorio/cobrancas" && vencidos > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                      {vencidos}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
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
