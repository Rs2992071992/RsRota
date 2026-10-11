import { redirect } from "next/navigation";
import { getSessaoInfo } from "@/lib/session";

export const dynamic = "force-dynamic";

// Quem já tem uma sessão VÁLIDA (assinatura, validade e versão confirmadas na
// BD) salta o login. Uma sessão antiga/revogada mostra o formulário normal.
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoInfo();
  if (sessao) redirect(sessao.perfil === "ESCRITORIO" ? "/escritorio/dashboard" : "/motorista/registo");
  return children;
}
