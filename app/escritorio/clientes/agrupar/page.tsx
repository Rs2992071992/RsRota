import Link from "next/link";
import { listarNomesClientes } from "@/lib/clientes-service";
import AgruparClientes from "@/components/AgruparClientes";

export const dynamic = "force-dynamic";

export default async function AgruparClientesPage() {
  const nomes = await listarNomesClientes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agrupar clientes</h1>
          <p className="text-sm text-gray-500">
            Junta variantes do mesmo cliente (ex.: escrito de forma diferente entre importações)
            num único nome. O histórico existente é atualizado já, e futuras importações passam a
            reconhecer as variantes automaticamente.
          </p>
        </div>
        <Link href="/escritorio/clientes" className="text-sm font-medium text-brand hover:underline">
          ← Voltar a Clientes
        </Link>
      </div>

      <AgruparClientes nomes={nomes} />
    </div>
  );
}
