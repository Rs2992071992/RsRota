import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  // 303 (See Other): força o browser a fazer GET em /login. Sem isto, o redirect
  // por defeito (307) preserva o método POST e /login devolve 405.
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
