import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { estimarDevisSchema } from "@/lib/validacao";
import { carregarContexto } from "@/lib/contexto";
import { snapshotParaRegisto } from "@/lib/snapshot-service";
import { calcularDistanciaKm } from "@/lib/distancia";
import { calcularPortagem } from "@/lib/portagens";
import { estimarLinha, kmComRegresso } from "@/lib/calc/orcamento";
import { resolverPaleteDimensoes } from "@/lib/rotas-service";

// POST /api/devis/estimar — calcula a distância (mapas, perfil pesado) e estima o
// custo + preço sugerido de uma linha de orçamento (só escritório). Nunca bloqueia:
// se a distância automática falhar devolve `kmAuto: null` + aviso e usa kmManual/0.
export async function POST(req: Request) {
  if (await getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = estimarDevisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // 1) Portagens de camião (TollGuru) — devolve também a distância da rota. Tentamos
  //    sempre que há moradas; serve de fonte principal do km automático.
  let kmAuto: number | null = null;
  let tollAuto: number | null = null;
  let avisoDistancia: string | undefined;
  let avisoPortagem: string | undefined;

  const temMoradas = !!d.origem.trim() && !!d.destino.trim();
  if (temMoradas) {
    const pg = await calcularPortagem(d.origem, d.destino, d.tipoVeiculo);
    if (pg.tollEur != null) tollAuto = pg.tollEur;
    else avisoPortagem = pg.erro;
    if (d.kmManual == null && pg.km != null) kmAuto = pg.km;
  }

  // 2) Distância: fallback no OpenRouteService se o TollGuru não deu km (e não é manual).
  if (d.kmManual == null && kmAuto == null && temMoradas) {
    const dist = await calcularDistanciaKm(d.origem, d.destino);
    kmAuto = dist.km;
    avisoDistancia = dist.erro;
  }

  // 3) Km final = manual, ou auto com regresso a vazio (× 2 se ida/volta).
  const km =
    d.kmManual != null ? d.kmManual : kmAuto != null ? kmComRegresso(kmAuto, d.idaVolta) : 0;

  // Portagem (ida) → também conta o regresso quando ida/volta.
  const portagemOverride = tollAuto != null ? tollAuto * (d.idaVolta ? 2 : 1) : null;

  // 4) Custo + preço sugerido via motor (snapshot do motorista/veículo + contexto).
  const [ctx, snapshot, paleteDimensoes] = await Promise.all([
    carregarContexto(),
    snapshotParaRegisto(d.motoristaId ?? null, d.veiculoId ?? null),
    resolverPaleteDimensoes(d.tipoPaleteId),
  ]);
  const { custoEstimado, precoSugerido, detalhe } = estimarLinha(
    {
      km,
      pesoKg: d.pesoKg,
      tipoVeiculo: d.tipoVeiculo,
      volume: d.volume,
      tipoPalete: d.tipoPalete,
      nPaletes: d.nPaletes,
      nMeiasPaletes: d.nMeiasPaletes,
      tipoPaleteId: d.tipoPaleteId,
      ...paleteDimensoes,
      pesoAproximado: d.pesoAproximado,
      zonaPortagem: d.zonaPortagem,
      noitesFora: d.noitesFora,
      alimentacao: d.alimentacao,
    },
    ctx,
    snapshot,
    portagemOverride,
  );

  return NextResponse.json({
    ok: true,
    kmAuto,
    km,
    tollAuto,
    custoEstimado,
    precoSugerido,
    detalhe, // decomposição interna (escritório); não vai para o PDF do cliente
    aviso: avisoDistancia,
    avisoPortagem,
  });
}
