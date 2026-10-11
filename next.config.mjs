/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer é pesado e não deve ser empacotado pelo webpack do servidor
  // (gera o PDF do orçamento na rota /api/devis/[id]/pdf). Opção estabilizada
  // (saiu de "experimental" no Next 15) — Next 16 deixou de aceitar a forma antiga.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Cabeçalhos de segurança em todas as respostas. Sem CSP de propósito: o
  // Next injeta scripts inline e uma CSP estrita partiria o site sem testes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede o site de ser embutido noutro (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
