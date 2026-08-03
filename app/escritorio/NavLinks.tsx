"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Route,
  Users,
  FileText,
  Euro,
  IdCard,
  Truck,
  Boxes,
  Settings,
  Upload,
} from "lucide-react";

const navItems = [
  { href: "/escritorio/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/escritorio/rotas", label: "Rotas", icon: Route },
  { href: "/escritorio/clientes", label: "Clientes", icon: Users },
  { href: "/escritorio/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/escritorio/cobrancas", label: "Cobranças", icon: Euro },
  { href: "/escritorio/motoristas", label: "Motoristas", icon: IdCard },
  { href: "/escritorio/veiculos", label: "Veículos", icon: Truck },
  { href: "/escritorio/cargas", label: "Cargas", icon: Boxes },
  { href: "/escritorio/parametros", label: "Parâmetros", icon: Settings },
  { href: "/escritorio/importar", label: "Importar", icon: Upload },
];

export default function NavLinks({ vencidos }: { vencidos: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {navItems.map((it) => {
        const ativo = pathname === it.href || pathname?.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              ativo ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{it.label}</span>
            <it.icon size={18} strokeWidth={1.75} />
            {it.href === "/escritorio/cobrancas" && vencidos > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                {vencidos}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
