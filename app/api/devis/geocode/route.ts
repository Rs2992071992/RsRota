import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { sugerirMoradas } from "@/lib/distancia";

// GET /api/devis/geocode?q=... — sugestões de morada (autocomplete ORS, só escritório).
export async function GET(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const sugestoes = await sugerirMoradas(q);
  return NextResponse.json({ sugestoes });
}
