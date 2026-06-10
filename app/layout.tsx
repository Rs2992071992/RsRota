import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão de Rotas — Rentabilidade",
  description: "Análise de rentabilidade de rotas de transporte Portugal ⇄ Espanha",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
