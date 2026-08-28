import { prisma } from "@/lib/db";
import { getSessaoInfo } from "@/lib/session";
import { listarNomesClientes } from "@/lib/clientes-service";
import HistoricoMotorista, { type ParagemHist } from "./HistoricoMotorista";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const sessao = getSessaoInfo();
  const motoristaId = sessao?.perfil === "MOTORISTA" ? sessao.id : -1;

  const [paragensRaw, portagens, params, veiculos, tiposPalete, nomesClientes] = await Promise.all([
    prisma.paragem.findMany({
      where: { motoristaId },
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.veiculo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true },
    }),
    // Motorista não tem acesso a /api/tipos-palete (só escritório) — vem
    // server-side, mesmo padrão de app/motorista/registo/page.tsx.
    prisma.tipoPalete.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    listarNomesClientes(),
  ]);

  const paragens: ParagemHist[] = paragensRaw.map((p) => ({
    id: p.id,
    idRota: p.idRota,
    data: p.data.toISOString(),
    tipoViagem: p.tipoViagem,
    tipoVeiculo: p.tipoVeiculo,
    veiculoId: p.veiculoId,
    cliente: p.cliente,
    kmInicial: p.kmInicial,
    kmFinal: p.kmFinal,
    kgCarregados: p.kgCarregados,
    kgDescarregados: p.kgDescarregados,
    volume: p.volume,
    tipoPalete: p.tipoPalete,
    nPaletes: p.nPaletes,
    tipoPaleteId: p.tipoPaleteId,
    pesoAproximado: p.pesoAproximado,
    zonaPortagem: p.zonaPortagem,
    portagensExtra: p.portagensExtra,
    noitesFora: p.noitesFora,
    alimentacao: p.alimentacao,
    horasExtra: p.horasExtra,
    faturarCliente: p.faturarCliente,
    litrosEspanha: p.litrosEspanha,
    custoEspanha: p.custoEspanha,
    receitaPaga: p.receitaPaga,
  }));

  return (
    <HistoricoMotorista
      paragens={paragens}
      zonas={portagens.map((p) => p.zona)}
      veiculos={veiculos}
      tiposPalete={tiposPalete}
      clientes={nomesClientes.map((c) => c.nome)}
      valorNoite={params?.valorNoite ?? 70}
    />
  );
}
