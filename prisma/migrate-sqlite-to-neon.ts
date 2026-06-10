/**
 * Migração única: copia TODOS os dados do SQLite local (prisma/dev.db)
 * para o Postgres de produção (Neon), preservando os ids e as relações.
 *
 * Uso: tsx prisma/migrate-sqlite-to-neon.ts
 * (DATABASE_URL no .env deve apontar para o Neon.)
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DB = "prisma/dev.db";

// Lê uma tabela do SQLite como array de objetos.
function read(table: string): any[] {
  const out = execSync(`sqlite3 -json ${DB} "SELECT * FROM ${table};"`, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : [];
}

// Colunas DateTime por tabela (guardadas como ms epoch no SQLite).
const dateCols: Record<string, string[]> = {
  Parametros: ["atualizadoEm"],
  Utilizador: ["criadoEm"],
  Paragem: ["data", "criadoEm", "atualizadoEm"],
};

function convertDates(table: string, row: any) {
  for (const col of dateCols[table] ?? []) {
    if (row[col] != null) row[col] = new Date(Number(row[col]));
  }
  return row;
}

async function main() {
  const parametros = read("Parametros").map((r) => convertDates("Parametros", r));
  const pneus = read("Pneu");
  const portagens = read("TabelaPortagem");
  const consumos = read("TabelaConsumo");
  const utilizadores = read("Utilizador").map((r) => convertDates("Utilizador", r));
  const paragens = read("Paragem").map((r) => convertDates("Paragem", r));

  console.log(
    `Origem SQLite → Parametros:${parametros.length} Pneus:${pneus.length} ` +
      `Portagens:${portagens.length} Consumos:${consumos.length} ` +
      `Utilizadores:${utilizadores.length} Paragens:${paragens.length}`,
  );

  // Limpa o destino (ordem respeita as FKs).
  await prisma.paragem.deleteMany();
  await prisma.utilizador.deleteMany();
  await prisma.tabelaConsumo.deleteMany();
  await prisma.tabelaPortagem.deleteMany();
  await prisma.pneu.deleteMany();
  await prisma.parametros.deleteMany();

  // Insere preservando ids (ordem respeita as FKs).
  if (parametros.length) await prisma.parametros.createMany({ data: parametros });
  if (pneus.length) await prisma.pneu.createMany({ data: pneus });
  if (portagens.length) await prisma.tabelaPortagem.createMany({ data: portagens });
  if (consumos.length) await prisma.tabelaConsumo.createMany({ data: consumos });
  if (utilizadores.length) await prisma.utilizador.createMany({ data: utilizadores });
  if (paragens.length) await prisma.paragem.createMany({ data: paragens });

  // Repõe as sequences do Postgres (senão inserções novas colidem nos ids).
  for (const t of ["Pneu", "TabelaPortagem", "TabelaConsumo", "Utilizador", "Paragem"]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), true)`,
    );
  }

  // Verificação no destino.
  const [u, p, rotas] = await Promise.all([
    prisma.utilizador.count(),
    prisma.paragem.count(),
    prisma.paragem.findMany({ distinct: ["idRota"], select: { idRota: true } }),
  ]);
  console.log(`Destino Neon → Utilizadores:${u} Paragens:${p} Rotas:${rotas.length}`);
  console.log("Rotas:", rotas.map((r) => r.idRota).sort().join(", "));
  console.log("✅ Migração concluída.");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
