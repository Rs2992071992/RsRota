/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer é pesado e não deve ser empacotado pelo webpack do servidor
  // (gera o PDF do orçamento na rota /api/devis/[id]/pdf). Opção estabilizada
  // (saiu de "experimental" no Next 15) — Next 16 deixou de aceitar a forma antiga.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Cabeçalhos de segurança em todas as respostas.
  async headers() {
    // CSP: o site só carrega recursos do próprio domínio (as ligações para a
    // ENSE são só para clicar). `unsafe-inline` em scripts/estilos é necessário
    // ao Next (scripts de hidratação inline e estilos); o ganho é bloquear
    // scripts/imagens/ligações a domínios de terceiros, formulários que enviam
    // para fora, <base> injetado e o site embutido noutro. Só em produção — em
    // desenvolvimento o Next usa eval. Testado com todas as páginas principais.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: csp }]
            : []),
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
