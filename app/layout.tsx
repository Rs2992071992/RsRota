import type { Metadata } from "next";
import "./globals.css";
import SelecaoCamposNumericos from "@/components/SelecaoCamposNumericos";

export const metadata: Metadata = {
  title: "RsRota — A tua rota, os teus custos, sob controlo",
  description: "Análise de rentabilidade de rotas de transporte Portugal ⇄ Espanha",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <SelecaoCamposNumericos />
        {children}
      </body>
    </html>
  );
}
