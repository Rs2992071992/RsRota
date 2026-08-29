import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { avariaSchema } from "@/lib/validacao";

// GET /api/avarias — lista avarias (qualquer sessão autenticada). Filtro
// opcional ?resolvida=false — usado pela app Android para mostrar as
// pendentes e evitar reportes duplicados.
export async function GET(req: Request) {
  const sessao = await getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const resolvidaParam = new URL(req.url).searchParams.get("resolvida");
  const where = resolvidaParam === null ? {} : { resolvida: resolvidaParam === "true" };

  const avarias = await prisma.avaria.findMany({
    where,
    include: { veiculo: { select: { nome: true, matricula: true } } },
    orderBy: { data: "desc" },
  });
  return NextResponse.json({ avarias });
}

// POST /api/avarias — reporta uma avaria (motorista ou escritório).
export async function POST(req: Request) {
  const sessao = await getSessaoInfo();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = avariaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const veiculo = await prisma.veiculo.findUnique({ where: { id: parsed.data.veiculoId } });
  if (!veiculo) return NextResponse.json({ erro: "Veículo não encontrado." }, { status: 404 });

  const { veiculoId, data, itens, observacoes } = parsed.data;
  const avaria = await prisma.avaria.create({
    data: {
      veiculoId,
      data: new Date(data),
      itens: itens.map((texto, id) => ({ id, texto, resolvido: false })),
      observacoes: observacoes || null,
      reportadoPorId: sessao.id,
    },
  });
  return NextResponse.json({ ok: true, avaria }, { status: 201 });
}
