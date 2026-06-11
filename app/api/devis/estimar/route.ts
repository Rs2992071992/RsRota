import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { estimarDevisSchema } from "@/lib/validacao";
import { carregarContexto } from "@/lib/contexto";
import { snapshotParaRegisto } from "@/lib/snapshot-service";
import { calcularDistanciaKm } from "@/lib/distancia";
import { estimarLinha, kmComRegresso } from "@/lib/calc/orcamento";

// POST /api/devis/estimar — calcula a distância (mapas, perfil pesado) e estima o
// custo + preço sugerido de uma linha de orçamento (só escritório). Nunca bloqueia:
// se a distância automática falhar devolve `kmAuto: null` + aviso e usa kmManual/0.
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
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

  // 1) Distância só de ida: manual tem prioridade; senão tenta o serviço de mapas.
  let kmAuto: number | null = null;
  let avisoDistancia: string | undefined;
  if (d.kmManual == null) {
    const dist = await calcularDistanciaKm(d.origem, d.destino);
    kmAuto = dist.km;
    avisoDistancia = dist.erro;
  }

  // 2) Km final = manual, ou auto com regresso a vazio (× 2 se ida/volta).
  const km =
    d.kmManual != null ? d.kmManual : kmAuto != null ? kmComRegresso(kmAuto, d.idaVolta) : 0;

  // 3) Custo + preço sugerido via motor (snapshot do motorista/veículo + contexto).
  const [ctx, snapshot] = await Promise.all([
    carregarContexto(),
    snapshotParaRegisto(d.motoristaId ?? null, d.veiculoId ?? null),
  ]);
  const { custoEstimado, precoSugerido } = estimarLinha(
    { km, pesoKg: d.pesoKg, tipoVeiculo: d.tipoVeiculo, zonaPortagem: d.zonaPortagem },
    ctx,
    snapshot,
  );

  return NextResponse.json({
    ok: true,
    kmAuto,
    km,
    custoEstimado,
    precoSugerido,
    aviso: avisoDistancia,
  });
}
