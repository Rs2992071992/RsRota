import Link from "next/link";
import { exigirPerfil } from "@/lib/session";

const navItems = [
  { href: "/escritorio/dashboard", label: "Dashboard" },
  { href: "/escritorio/rotas", label: "Rotas" },
  { href: "/escritorio/motoristas", label: "Motoristas" },
  { href: "/escritorio/veiculos", label: "Veículos" },
  { href: "/escritorio/parametros", label: "Parâmetros" },
  { href: "/escritorio/importar", label: "Importar" },
];

export default function EscritorioLayout({ children }: { children: React.ReactNode }) {
  exigirPerfil("ESCRITORIO");
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
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  {it.label}
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
    </div>
  );
}
