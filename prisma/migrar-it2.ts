import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Migração de dados da iteração 2 (corrida UMA vez após `prisma db push`):
 *  1. `noitesFora` deixou de ser euros e passa a ser um nº de noites. Convertemos
 *     os valores antigos (euros) dividindo pelo valor por noite (round). Com
 *     valorNoite = 70 e os dados existentes (0 ou 70 €), 70€ -> 1 noite e o custo
 *     recalculado (1 × 70) fica idêntico — preserva o match com o Excel.
 *  2. `tipoVeiculo` "RETORNO" -> "VAZIO" (cálculo idêntico; peso 0).
 */
async function main() {
  const params = await prisma.parametros.findUnique({ where: { id: 1 } });
  const valorNoite = params?.valorNoite ?? 70;

  const paragens = await prisma.paragem.findMany();
  let noitesConvertidas = 0;
  let retornos = 0;

  for (const p of paragens) {
    const data: { noitesFora?: number; tipoVeiculo?: string } = {};

    // Heurística: só convertemos valores que parecem euros (>= valorNoite),
    // para não estragar contagens já corretas se o script correr duas vezes.
    if (p.noitesFora >= valorNoite) {
      data.noitesFora = Math.round(p.noitesFora / valorNoite);
      noitesConvertidas++;
    }
    if (p.tipoVeiculo === "RETORNO") {
      data.tipoVeiculo = "VAZIO";
      retornos++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.paragem.update({ where: { id: p.id }, data });
    }
  }

  console.log(`Migração it2 concluída.`);
  console.log(`  Noites convertidas (euros -> contagem): ${noitesConvertidas}`);
  console.log(`  RETORNO -> VAZIO: ${retornos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
