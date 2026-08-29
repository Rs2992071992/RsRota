/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer é pesado e não deve ser empacotado pelo webpack do servidor
  // (gera o PDF do orçamento na rota /api/devis/[id]/pdf). Opção estabilizada
  // (saiu de "experimental" no Next 15) — Next 16 deixou de aceitar a forma antiga.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
