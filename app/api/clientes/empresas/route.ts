import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessao } from "@/lib/session";
import { atribuirEmpresaSchema } from "@/lib/validacao";

// POST /api/clientes/empresas — atribui um grupo de clientes a uma empresa-mãe
// (só escritório). Cria a ficha de cliente se ainda não existir (mesmo padrão
// de upsert usado em /api/clientes/agrupar).
export async function POST(req: Request) {
  if (getSessao() !== "ESCRITORIO") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = atribuirEmpresaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { nomes, empresaId } = parsed.data;
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });

  await prisma.$transaction(
    [...new Set(nomes.map((n) => n.trim()))].map((nome) =>
      prisma.cliente.upsert({
        where: { nome },
        create: { nome, empresaId },
        update: { empresaId },
      }),
    ),
  );

  return NextResponse.json({ ok: true, n: nomes.length });
}
