import Link from "next/link";
import { listarNomesClientes } from "@/lib/clientes-service";
import { listarEmpresas, mapaClienteEmpresa } from "@/lib/empresas-service";
import AtribuirEmpresa from "@/components/AtribuirEmpresa";

export const dynamic = "force-dynamic";

export default async function AtribuirEmpresaPage() {
  const [nomes, empresas, mapa] = await Promise.all([
    listarNomesClientes(),
    listarEmpresas(),
    mapaClienteEmpresa(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Atribuir empresa</h1>
          <p className="text-sm text-gray-500">
            Diz a quem se cobra cada cliente (a empresa-mãe). Usado para agrupar e subtotalizar a
            página de Cobranças por empresa.
          </p>
        </div>
        <Link href="/escritorio/clientes" className="text-sm font-medium text-brand hover:underline">
          ← Voltar a Clientes
        </Link>
      </div>

      <AtribuirEmpresa nomes={nomes} empresas={empresas} mapaAtual={Object.fromEntries(mapa)} />
    </div>
  );
}
