/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer é pesado e não deve ser empacotado pelo webpack do servidor
  // (gera o PDF do orçamento na rota /api/devis/[id]/pdf).
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
