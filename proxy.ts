import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// O middleware corre no Edge runtime (sem node:crypto), por isso aqui fazemos
// apenas routing de UX com base na PRESENÇA/forma da cookie. A validação forte da
// assinatura HMAC acontece server-side em getSessao() (lib/session.ts), usada por
// todas as páginas e rotas API protegidas.
function perfilFromCookie(value: string | undefined): "ESCRITORIO" | "MOTORISTA" | null {
  if (!value) return null;
  // Formato da cookie: "<perfil>:<id>:<expira>:<versao>.<hmac>". Aqui só se
  // confere a forma e a validade (a assinatura e a versão validam-se em
  // lib/session.ts) — cookies no formato antigo ou expirados contam como sem sessão.
  const partes = value.split(".")[0].split(":");
  if (partes.length !== 4) return null;
  const expira = Number(partes[2]);
  if (!Number.isFinite(expira) || expira * 1000 <= Date.now()) return null;
  const perfil = partes[0];
  return perfil === "ESCRITORIO" || perfil === "MOTORISTA" ? perfil : null;
}

/**
 * Origens externas autorizadas a chamar a API por CORS (apps nativas de origem
 * diferente, ex. Motorista offline em capacitor://). O site/páginas nunca passam
 * por aqui (mesma origem, sem preflight). Lista ajustável só por env var — não
 * sabemos ainda a origem exata da app Motorista (por construir).
 */
function origensPermitidas(): string[] {
  const env = process.env.APP_ORIGINS_PERMITIDAS;
  return (env ?? "capacitor://localhost,http://localhost,https://localhost")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function comCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin && origensPermitidas().includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(CORS_HEADERS_BASE)) res.headers.set(k, v);
  }
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CORS para a API — só relevante para apps nativas fora da origem do site
  // (o browser/WebView em mesma origem nunca envia preflight nem precisa disto).
  if (pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") {
      return comCors(new NextResponse(null, { status: 204 }), origin);
    }
    return comCors(NextResponse.next(), origin);
  }

  const perfil = perfilFromCookie(req.cookies.get(SESSION_COOKIE)?.value);

  // /login NÃO redireciona por aqui: o cookie pode parecer válido e já ter sido
  // revogado (PIN mudado), e mandar para o painel — que o recusa e volta a
  // mandar para /login — daria um ciclo infinito. O redirect de quem já tem
  // sessão válida está em app/login/layout.tsx (valida a sessão a sério).

  const precisaEscritorio = pathname.startsWith("/escritorio");
  const precisaMotorista = pathname.startsWith("/motorista");

  if (precisaEscritorio || precisaMotorista) {
    if (!perfil) return NextResponse.redirect(new URL("/login", req.url));
    // Escritório pode ver tudo; motorista só a sua área.
    if (precisaEscritorio && perfil !== "ESCRITORIO") {
      return NextResponse.redirect(new URL("/motorista/registo", req.url));
    }
    // "/escritorio" e "/motorista" (caminho exato, sem sub-página) não têm page.tsx
    // próprio — sem este redirect dava 404 para quem já tem sessão (ex.: app Android
    // que abre direto em /escritorio).
    if (pathname === "/escritorio" || pathname === "/motorista") {
      return NextResponse.redirect(new URL(homeFor(perfil), req.url));
    }
  }

  return NextResponse.next();
}

function homeFor(perfil: string): string {
  return perfil === "ESCRITORIO" ? "/escritorio/dashboard" : "/motorista/registo";
}

export const config = {
  matcher: ["/login", "/escritorio/:path*", "/motorista/:path*", "/api/:path*"],
};
