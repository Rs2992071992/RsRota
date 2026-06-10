import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// O middleware corre no Edge runtime (sem node:crypto), por isso aqui fazemos
// apenas routing de UX com base na PRESENÇA/forma da cookie. A validação forte da
// assinatura HMAC acontece server-side em getSessao() (lib/session.ts), usada por
// todas as páginas e rotas API protegidas.
function perfilFromCookie(value: string | undefined): "ESCRITORIO" | "MOTORISTA" | null {
  if (!value) return null;
  // Formato da cookie: "<perfil>:<id>.<hmac>".
  const perfil = value.split(".")[0].split(":")[0];
  return perfil === "ESCRITORIO" || perfil === "MOTORISTA" ? perfil : null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const perfil = perfilFromCookie(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && perfil) {
    return NextResponse.redirect(new URL(homeFor(perfil), req.url));
  }

  const precisaEscritorio = pathname.startsWith("/escritorio");
  const precisaMotorista = pathname.startsWith("/motorista");

  if (precisaEscritorio || precisaMotorista) {
    if (!perfil) return NextResponse.redirect(new URL("/login", req.url));
    // Escritório pode ver tudo; motorista só a sua área.
    if (precisaEscritorio && perfil !== "ESCRITORIO") {
      return NextResponse.redirect(new URL("/motorista/registo", req.url));
    }
  }

  return NextResponse.next();
}

function homeFor(perfil: string): string {
  return perfil === "ESCRITORIO" ? "/escritorio/dashboard" : "/motorista/registo";
}

export const config = {
  matcher: ["/login", "/escritorio/:path*", "/motorista/:path*"],
};
