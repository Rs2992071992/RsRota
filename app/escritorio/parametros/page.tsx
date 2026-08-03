import { prisma } from "@/lib/db";
import ParametrosForm from "./ParametrosForm";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const [params, pneus, portagens, consumo, tiposPalete] = await Promise.all([
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.pneu.findMany({ orderBy: { ordem: "asc" } }),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    prisma.tabelaConsumo.findMany({ orderBy: { cargaKg: "asc" } }),
    prisma.tipoPalete.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
  ]);

  if (!params) {
    return <p>Parâmetros não inicializados. Corra <code>npm run db:seed</code>.</p>;
  }

  return (
    <ParametrosForm
      paramsIniciais={params}
      pneusIniciais={pneus.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km }))}
      portagensIniciais={portagens.map((p) => ({ zona: p.zona, valor: p.valor }))}
      consumoIniciais={consumo.map((c) => ({ cargaKg: c.cargaKg, consumoL100: c.consumoL100 }))}
      tiposPaleteIniciais={tiposPalete.map((t) => ({
        id: t.id,
        nome: t.nome,
        comprimentoMm: t.comprimentoMm,
        larguraMm: t.larguraMm,
        ativo: t.ativo,
      }))}
    />
  );
}
