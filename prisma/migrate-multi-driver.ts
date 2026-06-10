/**
 * Migração para o modelo multi-motorista / multi-veículo (frota + histórico fixo).
 *
 * Passos (idempotente — pode correr-se mais de uma vez):
 *  1. Lê `Parametros(id=1)` e cria um veículo "Camião principal" com os valores
 *     atuais de veículo + uma cópia dos pneus globais (template).
 *  2. Aplica os 7 campos salariais atuais (de Parametros) a todos os motoristas.
 *  3. Carimba esse veículo nas paragens sem `veiculoId`.
 *
 * NÃO gera snapshots para as paragens antigas: ficam a null e o cálculo cai no
 * fallback (defaults globais = valores atuais), preservando os totais validados
 * ao cêntimo (HILP01 = 1487,73 €). Pré-requisito: `prisma db push` já aplicado.
 *
 * Correr com: `npx tsx prisma/migrate-multi-driver.ts`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const base = await prisma.parametros.findUnique({ where: { id: 1 } });
  if (!base) throw new Error("Parametros(id=1) não existe. Corra o seed primeiro.");

  // 1. Veículo por defeito com os valores atuais (se ainda não houver veículos).
  let veiculo = await prisma.veiculo.findFirst({ orderBy: { id: "asc" } });
  if (!veiculo) {
    const pneusGlobais = await prisma.pneu.findMany({
      where: { veiculoId: null },
      orderBy: { ordem: "asc" },
    });
    veiculo = await prisma.veiculo.create({
      data: {
        nome: "Camião principal",
        valorAquisicao: base.valorAquisicao,
        valorResidual: base.valorResidual,
        vidaUtilAnos: base.vidaUtilAnos,
        iucAnual: base.iucAnual,
        taxaJuros: base.taxaJuros,
        seguroAnual: base.seguroAnual,
        reparacoesAnuais: base.reparacoesAnuais,
        revisaoAnual: base.revisaoAnual,
        inspecaoAnual: base.inspecaoAnual,
        capacidadeCamiao: base.capacidadeCamiao,
        capacidadeReboque: base.capacidadeReboque,
        pneus: {
          create: pneusGlobais.map((p, i) => ({
            eixo: p.eixo,
            custo: p.custo,
            km: p.km,
            ordem: p.ordem || i + 1,
          })),
        },
      },
    });
    console.log(`  Veículo por defeito criado: #${veiculo.id} "${veiculo.nome}"`);
  } else {
    console.log(`  Veículo já existe: #${veiculo.id} "${veiculo.nome}" (sem alterações)`);
  }

  // 2. Aplica os parâmetros salariais atuais a todos os motoristas.
  const upd = await prisma.utilizador.updateMany({
    where: { perfil: "MOTORISTA" },
    data: {
      salarioMensal: base.salarioMensal,
      seguroMensal: base.seguroMensal,
      percentEncargos: base.percentEncargos,
      alimentacaoDia: base.alimentacaoDia,
      diasAlimentacao: base.diasAlimentacao,
      kmAnuais: base.kmAnuais,
      fatorAnualizacao: base.fatorAnualizacao,
    },
  });
  console.log(`  Parâmetros salariais aplicados a ${upd.count} motorista(s).`);

  // 3. Carimba o veículo nas paragens sem veículo.
  const carimbo = await prisma.paragem.updateMany({
    where: { veiculoId: null },
    data: { veiculoId: veiculo.id },
  });
  console.log(`  Veículo atribuído a ${carimbo.count} paragem(ns) antiga(s).`);

  console.log("Migração concluída. As paragens antigas ficam sem snapshot (fallback = valores atuais).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
