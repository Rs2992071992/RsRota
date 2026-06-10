import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// PINs por defeito (documentados no README). Alterar em produção.
const PIN_ESCRITORIO = "1234";
const PIN_MOTORISTA = "0000";

async function main() {
  // --- Parâmetros (singleton id=1) com os valores atuais (§3.4) ---
  await prisma.parametros.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }, // todos os defaults estão no schema
  });

  // --- Pneus por eixo (template global: veiculoId null) ---
  const pneus = [
    { eixo: "1 Eixo", custo: 1280, km: 180000, ordem: 1 },
    { eixo: "2 Eixo", custo: 1680, km: 120000, ordem: 2 }, // 420 × 4
    { eixo: "3 Eixo", custo: 740, km: 200000, ordem: 3 },
    { eixo: "4 Eixo", custo: 620, km: 180000, ordem: 4 },
    { eixo: "5 Eixo", custo: 880, km: 180000, ordem: 5 },
  ];
  if ((await prisma.pneu.count({ where: { veiculoId: null } })) === 0) {
    await prisma.pneu.createMany({ data: pneus });
  }

  // --- Veículo por defeito (frota) com os valores atuais + os seus pneus ---
  if ((await prisma.veiculo.count()) === 0) {
    await prisma.veiculo.create({
      data: {
        nome: "Camião principal",
        // restantes campos de custo usam os defaults do schema (= valores §3.4)
        pneus: { create: pneus.map((p) => ({ eixo: p.eixo, custo: p.custo, km: p.km, ordem: p.ordem })) },
      },
    });
  }

  // --- Tabela de portagens (classe 4, só de ida) ---
  const portagens = [
    { zona: "Galiza", valor: 72.7 }, // 60,2 + 12,5
    { zona: "Armazém norte", valor: 28.65 },
    { zona: "MarTorres3", valor: 14.15 },
    { zona: "VilarFormoso", valor: 18.15 },
    { zona: "Zambujeira", valor: 35.0 },
    { zona: "AveirasStubal3", valor: 11.35 },
    { zona: "MARsesimbra3", valor: 22.3 },
    { zona: "Tecges", valor: 8.7 },
    { zona: "SPortagem", valor: 0.0 },
  ];
  for (const p of portagens) {
    await prisma.tabelaPortagem.upsert({
      where: { zona: p.zona },
      update: { valor: p.valor },
      create: p,
    });
  }

  // --- Tabela de consumo por carga ---
  const consumo = [
    { cargaKg: 0, consumoL100: 25 },
    { cargaKg: 10000, consumoL100: 28 },
    { cargaKg: 15000, consumoL100: 31 },
    { cargaKg: 20000, consumoL100: 35 },
    { cargaKg: 24000, consumoL100: 38 },
    { cargaKg: 27000, consumoL100: 45 },
  ];
  for (const c of consumo) {
    await prisma.tabelaConsumo.upsert({
      where: { cargaKg: c.cargaKg },
      update: { consumoL100: c.consumoL100 },
      create: c,
    });
  }

  // --- Utilizadores ---
  // Escritório: uma única conta (login por PIN). Os motoristas criam-se em runtime
  // na página de login (ID + PIN), por isso aqui criamos só um motorista de exemplo.
  await prisma.utilizador.upsert({
    where: { codigo: "ESCRITORIO" },
    update: {},
    create: {
      codigo: "ESCRITORIO",
      perfil: "ESCRITORIO",
      pinHash: bcrypt.hashSync(PIN_ESCRITORIO, 10),
    },
  });
  await prisma.utilizador.upsert({
    where: { codigo: "motorista" },
    update: {},
    create: {
      codigo: "motorista",
      nome: "Motorista exemplo",
      perfil: "MOTORISTA",
      pinHash: bcrypt.hashSync(PIN_MOTORISTA, 10),
    },
  });

  console.log("Seed concluído.");
  console.log(`  Escritório → PIN ${PIN_ESCRITORIO}`);
  console.log(`  Motorista exemplo → ID "motorista", PIN ${PIN_MOTORISTA}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
