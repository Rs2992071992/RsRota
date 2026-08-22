/**
 * Migração única: converte Paragem.tipoVeiculo ainda literalmente
 * "PALETE_120X80"/"PALETE_120X100" (pré Volume+tipoPalete) para o novo
 * formato — volume=true, tipoPalete=<valor antigo>, tipoVeiculo=
 * "CAMIAO+REBOQUE" (esses literais sempre significaram camião+reboque,
 * nunca existiu a distinção "só camião" antes desta migração).
 *
 * Só toca tipoVeiculo/volume/tipoPalete — nunca em nPaletes/kgCarregados/
 * snapshot/receitaPaga — para preservar o histórico ao cêntimo.
 *
 * Uso: npx tsx prisma/migrate-paletes-volume.ts
 * (DATABASE_URL no .env deve apontar para a Neon de produção.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TIPOS_ANTIGOS = ["PALETE_120X80", "PALETE_120X100"] as const;

async function main() {
  const antes = await prisma.paragem.count({
    where: { tipoVeiculo: { in: [...TIPOS_ANTIGOS] } },
  });
  console.log(`Paragens a migrar: ${antes}`);

  for (const tipo of TIPOS_ANTIGOS) {
    const r = await prisma.paragem.updateMany({
      where: { tipoVeiculo: tipo },
      data: { tipoVeiculo: "CAMIAO+REBOQUE", volume: true, tipoPalete: tipo },
    });
    console.log(`${tipo} -> CAMIAO+REBOQUE (volume=true, tipoPalete=${tipo}): ${r.count} linha(s)`);
  }

  const depois = await prisma.paragem.count({
    where: { tipoVeiculo: { in: [...TIPOS_ANTIGOS] } },
  });
  const migradas = await prisma.paragem.count({ where: { volume: true } });
  console.log(`Restantes com tipoVeiculo antigo: ${depois} (esperado: 0)`);
  console.log(`Total com volume=true agora: ${migradas} (esperado: ${antes})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
