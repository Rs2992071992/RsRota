import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { carregarRota } from "@/lib/rotas-service";
import { listarNomesClientes } from "@/lib/clientes-service";
import { fmtEuro, fmtNum, fmtNum2, fmtData } from "@/lib/format";
import { estadoPagamento } from "@/lib/calc/pagamentos";
import { verificarEspacoCarga, gerarPlantaCargaRota, linhasCargaParagem } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";
import { AlertaBadge } from "@/components/Badge";
import CarregamentoFloorPlan from "@/components/CarregamentoFloorPlan";
import ParagemAcoes from "@/components/ParagemAcoes";
import PagoToggle from "@/components/PagoToggle";
import EstadoPagamentoBadge from "@/components/EstadoPagamentoBadge";
import RotaCombustivelOverride from "@/components/RotaCombustivelOverride";
import DespesasIcones from "@/components/DespesasIcones";
import type { ParagemEditavel } from "@/components/ParagemEditor";

export const dynamic = "force-dynamic";

export default async function RotaDetalhe(props: { params: Promise<{ idRota: string }> }) {
  const params = await props.params;
  const idRota = decodeURIComponent(params.idRota);
  const [{ rota, paragensRaw }, portagens, parametros, veiculos, tiposPalete, nomesClientes] = await Promise.all([
    carregarRota(idRota),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.veiculo.findMany({
      where: { categoria: "PESADO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true },
    }),
    prisma.tipoPalete.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    listarNomesClientes(),
  ]);
  if (!rota) notFound();

  const zonas = portagens.map((p) => p.zona);
  const clientes = nomesClientes.map((c) => c.nome);
  const valorNoite = parametros?.valorNoite ?? 70;
  const precoCombRef = parametros?.precoCombRef ?? 1.834;
  // Valor comum a todas as paragens da rota (null = a usar o padrão, ou valores mistos).
  const overridesRota = Array.from(new Set(paragensRaw.map((p) => p.precoCombRefOverride ?? null)));
  const overrideRotaAtual = overridesRota.length === 1 ? overridesRota[0] : null;
  const rawPorId = new Map(paragensRaw.map((r) => [r.id, r]));
  const totalKgCarregados = paragensRaw.reduce((a, p) => a + p.kgCarregados, 0);
  const totalKgDescarregados = paragensRaw.reduce((a, p) => a + p.kgDescarregados, 0);
  // Rotas por paletes (2026-08-28+): o foco passa a ser a quantidade de paletes
  // transportadas, não os kg. O peso deixa de vir de kgCarregados/Descarregados
  // (ficam a 0 nestas paragens) — passa a somar-se o peso aproximado que o
  // motorista introduziu por paragem (informativo). Rotas antigas por peso
  // (totalPaletes=0) continuam a mostrar os cartões de kg como sempre.
  // totalPaletes/totalPesoAproximado vêm de calcularRota (não somados aqui à
  // parte) — uma recolha faturada a outro cliente que também tem entrega
  // nesta rota já não conta a dobra (2026-09-04).
  const totalPesoAproximado = rota.totalPesoAproximado;
  const totalPesoAproximadoCarregado = rota.totalPesoAproximadoCarregado;
  const datasParagens = paragensRaw.map((p) => p.data);
  const dataRotaLabel =
    datasParagens.length === 0
      ? null
      : (() => {
          const min = new Date(Math.min(...datasParagens.map((d) => d.getTime())));
          const max = new Date(Math.max(...datasParagens.map((d) => d.getTime())));
          const minStr = fmtData(min);
          const maxStr = fmtData(max);
          return minStr === maxStr ? minStr : `${minStr} – ${maxStr}`;
        })();
  const editavel = (id: number): ParagemEditavel | null => {
    const p = paragensRaw.find((x) => x.id === id);
    if (!p) return null;
    return {
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
      nMeiasPaletes: p.nMeiasPaletes,
      tipoPaleteId: p.tipoPaleteId,
      paletes: Array.isArray(p.paletes)
        ? (p.paletes as {
            tipoPaleteId: number | null;
            comprimentoMm: number;
            larguraMm: number;
            nPaletes: number;
            sentido?: "ENTREGA" | "RECOLHA";
          }[])
        : null,
      recolha: p.recolha,
      pesoAproximado: p.pesoAproximado,
      pesoAproximadoCarregado: p.pesoAproximadoCarregado,
      zonaPortagem: p.zonaPortagem,
      portagensExtra: p.portagensExtra,
      noitesFora: p.noitesFora,
      alimentacao: p.alimentacao,
      horasExtra: p.horasExtra,
      faturarCliente: p.faturarCliente,
      litrosEspanha: p.litrosEspanha,
      custoEspanha: p.custoEspanha,
      receitaPaga: p.receitaPaga,
      rateioManual: p.rateioManual as { cliente: string; km: number }[] | null,
    };
  };
  const clientesRota = rota.rateio.map((c) => c.cliente);

  // Sobreocupação: as paletes registadas na rota cabem no veículo (+ reboque)?
  const veicRota = paragensRaw.find((p) => p.tipoVeiculo !== "VAZIO" && p.veiculo)?.veiculo ?? null;
  const rotaTemReboque = paragensRaw.some((p) => p.tipoVeiculo === "CAMIAO+REBOQUE");
  const caixasRota: CaixaInput[] = [];
  if (veicRota?.caixaComprimentoMm && veicRota.caixaLarguraMm) {
    caixasRota.push({
      id: "veiculo",
      label: veicRota.nome,
      comprimentoMm: veicRota.caixaComprimentoMm,
      larguraMm: veicRota.caixaLarguraMm,
    });
  }
  if (rotaTemReboque && veicRota?.reboqueHabitual) {
    caixasRota.push({
      id: "reboque",
      label: veicRota.reboqueHabitual.nome,
      comprimentoMm: veicRota.reboqueHabitual.comprimentoMm,
      larguraMm: veicRota.reboqueHabitual.larguraMm,
    });
  }
  const paragensCarga = paragensRaw.map((p) => ({
    ...linhasCargaParagem(p),
    tipoVeiculo: p.tipoVeiculo,
    kmInicial: p.kmInicial,
    cliente: p.cliente,
    faturarCliente: p.faturarCliente,
  }));
  const espacoCarga = verificarEspacoCarga(caixasRota, paragensCarga);
  // Planta de carga do pior momento da rota — mesma simulação do aviso acima,
  // gerada a partir das paragens já registadas (sem recriar pedidos à mão).
  const packingRota = gerarPlantaCargaRota(caixasRota, paragensCarga);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/escritorio/rotas" className="text-sm text-gray-500 hover:underline">
            ← Rotas
          </Link>
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold">Rota {rota.idRota}</h1>
            {dataRotaLabel && <span className="text-sm font-normal text-gray-500">{dataRotaLabel}</span>}
          </div>
        </div>
        <AlertaBadge alerta={rota.alerta} />
      </div>

      {espacoCarga.verificavel && !espacoCarga.cabemTodas && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ⚠ As paletes registadas não cabem todas
          {veicRota ? ` no ${veicRota.nome}` : " no veículo"}
          {rotaTemReboque ? " + reboque" : ""}: no momento de maior carga da rota cabem{" "}
          {espacoCarga.colocadas} de {espacoCarga.totalPaletes} ({espacoCarga.semEspaco} sem
          espaço). Simulação da ocupação ao longo da rota (entregas saem, recolhas entram).
        </div>
      )}

      {/* Resumo rentabilidade */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card">
          <p className="text-xs text-gray-500">Custo total</p>
          <p className="text-lg font-bold">{fmtEuro(rota.custoTotalRota)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Preço mínimo (×1,25)</p>
          <p className="text-lg font-bold">{fmtEuro(rota.precoMinimo)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Receita</p>
          <p className="text-lg font-bold">{fmtEuro(rota.receitaTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Lucro</p>
          <p className={`text-lg font-bold ${rota.lucro < 0 ? "text-red-600" : "text-green-600"}`}>
            {fmtEuro(rota.lucro)}
          </p>
        </div>
      </div>

      {/* Carga total da rota (soma de todas as paragens) — paletes (2026-08-28+)
          ou kg (rotas antigas por peso), consoante o que a rota tem. */}
      <div className="grid grid-cols-2 gap-3">
        {rota.totalPaletes > 0 ? (
          <>
            <div className="card">
              <p className="text-xs text-gray-500">Paletes transportadas</p>
              <p className="text-lg font-bold">{fmtNum(rota.totalPaletes)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500">Peso aproximado</p>
              <p className="text-lg font-bold">
                {totalPesoAproximado > 0 || totalPesoAproximadoCarregado > 0
                  ? [
                      totalPesoAproximado > 0 ? `${fmtNum(totalPesoAproximado)} kg desc.` : null,
                      totalPesoAproximadoCarregado > 0 ? `${fmtNum(totalPesoAproximadoCarregado)} kg rec.` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "—"}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <p className="text-xs text-gray-500">Total KG Carregados</p>
              <p className="text-lg font-bold">{fmtNum(totalKgCarregados)} kg</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500">Total KG Descarregados</p>
              <p className="text-lg font-bold">{fmtNum(totalKgDescarregados)} kg</p>
            </div>
          </>
        )}
      </div>

      {/* Decomposição do custo da rota */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Decomposição do custo da rota</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          <Item label="Custos das paragens" valor={rota.somaCustoParagens} />
          <Item label="Portagens extra" valor={rota.paragens.reduce((a, p) => a + p.portagensExtra, 0)} />
          <Item label="Noites" valor={rota.somaNoites} />
          <Item label="Alimentação" valor={rota.somaAlimentacao} />
          <Item
            label="Horas extra"
            valor={rota.somaHorasExtraValor}
            prefixo={`${fmtNum(paragensRaw.reduce((a, p) => a + p.horasExtra, 0))}H - `}
          />
          <Item label="Portagens (tabela)" valor={rota.somaPortagensTabela} />
          <div className="flex justify-between border-t border-gray-200 pt-2 font-bold md:col-span-3">
            <span>Custo total</span>
            <span>{fmtEuro(rota.custoTotalRota)}</span>
          </div>
        </dl>
      </div>

      {/* Correção do preço de ref. combustível desta rota */}
      <div className="card">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Combustível desta rota</h2>
          <a
            href="https://www.ense-epe.pt/precos-de-referencia/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand underline"
          >
            ⛽ Ver preços de referência (ENSE) ↗
          </a>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Corrige o preço de referência do combustível para todas as paragens desta rota de uma vez.
          Deixe vazio para usar o valor de Parâmetros ({fmtNum2(precoCombRef)} €/L).
        </p>
        <RotaCombustivelOverride
          idRota={rota.idRota}
          valorAtual={overrideRotaAtual}
          precoParametro={precoCombRef}
        />
      </div>

      {/* Paragens detalhadas */}
      <div className="card scroll-fade-x overflow-x-auto">
        <h2 className="mb-3 font-semibold">Paragens</h2>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Cliente</th>
              <th className="th">Veículo</th>
              <th className="th text-right">KM</th>
              <th className="th text-right">Peso / Paletes</th>
              <th className="th text-right">Coef. carga</th>
              <th className="th text-right">Comb.</th>
              <th className="th text-right">Motorista</th>
              <th className="th text-right">Veículo</th>
              <th className="th text-right">AdBlue</th>
              <th className="th text-right">Port. extra</th>
              <th className="th text-right">Custo paragem</th>
              <th className="th text-right">L/100km</th>
              <th className="th text-right">A cobrar</th>
              <th className="th text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rota.paragens.map((p, i) => (
              <tr key={p.id ?? i}>
                <td className="td font-medium">
                  {p.cliente}
                  {p.faturarCliente ? (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
                      recolha → {p.faturarCliente}
                    </span>
                  ) : (
                    p.recolha && (
                      <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-normal text-red-800">
                        recolha — por atribuir
                      </span>
                    )
                  )}
                  <DespesasIcones raw={p.id ? rawPorId.get(p.id) : undefined} />
                </td>
                <td className="td">{p.tipoVeiculo}</td>
                <td className="td text-right">{fmtNum(p.kmFeitos)}</td>
                <td className="td text-right">
                  {(() => {
                    // Rotas por paletes: kgCarregados/Descarregados ficam a 0
                    // (não se regista peso) — mostra o peso aproximado
                    // descarregado/recolhido que o motorista introduziu + o nº
                    // de paletes ("PL"). Rotas por kg (legado): mantém o peso
                    // transportado como sempre.
                    const pesoDesc = p.pesoTransportado > 0 ? p.pesoTransportado : p.pesoAproximado || 0;
                    const pesoCarr = p.pesoTransportado > 0 ? 0 : p.pesoAproximadoCarregado || 0;
                    const pesoTxt =
                      pesoDesc > 0 && pesoCarr > 0
                        ? `${fmtNum(pesoDesc)}/${fmtNum(pesoCarr)} kg`
                        : pesoCarr > 0
                          ? `${fmtNum(pesoCarr)} kg rec.`
                          : pesoDesc > 0
                            ? `${fmtNum(pesoDesc)} kg`
                            : "—";
                    return p.nPaletes > 0 ? `${pesoTxt} · ${fmtNum(p.nPaletes)} PL` : pesoTxt;
                  })()}
                </td>
                <td className="td text-right">{(p.coeficienteCarga * 100).toFixed(2)}%</td>
                <td className="td text-right">{fmtEuro(p.custoCombustivel)}</td>
                <td className="td text-right">{fmtEuro(p.custoMotorista)}</td>
                <td className="td text-right">{fmtEuro(p.custoVeiculo)}</td>
                <td className="td text-right">{fmtEuro(p.custoAdblue)}</td>
                <td className="td text-right">{fmtEuro(p.portagensExtra)}</td>
                <td className="td text-right font-semibold">{fmtEuro(p.custoParagem)}</td>
                <td className="td text-right">{p.consumoL100 > 0 ? fmtNum2(p.consumoL100) : "—"}</td>
                <td className="td text-right">{fmtEuro(p.id ? raw(paragensRaw, p.id) : 0)}</td>
                <td className="td text-right">
                  {p.id && editavel(p.id) ? (
                    <ParagemAcoes
                      paragem={editavel(p.id)!}
                      zonas={zonas}
                      veiculos={veiculos}
                      tiposPalete={tiposPalete}
                      clientes={clientes}
                      clientesRota={clientesRota}
                      valorNoite={valorNoite}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rota.paragens.some((p) => p.litrosEspanha > 0) && (
          <p className="mt-3 text-xs text-gray-500">
            💡 Poupança Espanha nesta rota:{" "}
            {fmtEuro(rota.paragens.reduce((a, p) => a + p.poupancaEspanha, 0))} (informativo, não
            entra no custo).
          </p>
        )}
      </div>

      {/* Rateio por cliente (auditável) */}
      <div className="card">
        <h2 className="mb-1 font-semibold">Rateio do custo por cliente</h2>
        <p className="mb-3 text-xs text-gray-500">
          Custo atribuído = quota do cliente × custo total da rota ({fmtEuro(rota.custoTotalRota)}).
          Cada troço (Ida/Volta/dia) reparte-se à parte, proporcional ao peso/capacidade de cada
          cliente NESSE troço — um cliente já não paga por um troço que não fez. Os trajetos a vazio
          repartem-se 50/50 entre os clientes do troço antes e do troço depois — a menos que o
          escritório atribua manualmente km desse vazio a clientes específicos, ao editar a paragem (o
          que não for atribuído continua a repartir-se 50/50 como sempre). A coluna "dos quais, vazio"
          isola só essa fatia. As paragens marcadas "recolha → Cliente" somam o seu custo à quota desse
          cliente em vez de gerarem linha própria. O coef. real (peso/capacidade) é só indicador: acima
          de 1 indica sobrecarga.
        </p>
        <div className="scroll-fade-x overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Cliente</th>
                <th className="th text-right">Coef. real</th>
                <th className="th text-right">Quota</th>
                <th className="th text-right">Custo atribuído</th>
                <th className="th text-right">dos quais, vazio</th>
                <th className="th text-right">Receita</th>
                <th className="th text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rota.rateio.map((c) => {
                const margem = c.receitaPaga - c.custoAtribuido;
                return (
                  <tr key={c.cliente}>
                    <td className="td font-medium">{c.cliente}</td>
                    <td className="td text-right">{fmtNum2(c.coefReal)}</td>
                    <td className="td text-right">{(c.quota * 100).toFixed(0)}%</td>
                    <td className="td text-right">{fmtEuro(c.custoAtribuido)}</td>
                    <td className="td text-right text-gray-500">
                      {c.custoVazioAtribuido > 0 ? fmtEuro(c.custoVazioAtribuido) : "—"}
                    </td>
                    <td className="td text-right">{fmtEuro(c.receitaPaga)}</td>
                    <td className={`td text-right font-semibold ${margem < 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmtEuro(margem)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planta de carga: pior momento da rota, gerada a partir das paragens já
          registadas — só de leitura (sem arrastar/rodar, não há pedidos aqui).
          <details>/<summary> nativo: clicar no título mostra/esconde, sem
          precisar de client component. */}
      {packingRota && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Planta de carga</summary>
          <p className="mb-3 mt-1 text-xs text-gray-400">
            Momento de maior ocupação da rota, gerado a partir das entregas/recolhas registadas.
          </p>
          <CarregamentoFloorPlan caixas={packingRota.caixas} />
        </details>
      )}

      {/* Cobranças — estado de pagamento (prazo 90 dias) */}
      <Cobrancas paragens={paragensRaw} faturado={rota.receitaTotal} />
    </div>
  );
}

function Item({ label, valor, prefixo }: { label: string; valor: number; prefixo?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-600">{label}</span>
      <span className="whitespace-nowrap font-medium">
        {prefixo}
        {fmtEuro(valor)}
      </span>
    </div>
  );
}

function raw(paragens: { id: number; receitaPaga: number }[], id: number): number {
  return paragens.find((p) => p.id === id)?.receitaPaga ?? 0;
}

/** Linha de cobrança (subconjunto de Paragem necessário para o estado de pagamento). */
type ParagemCobranca = {
  id: number;
  cliente: string;
  data: Date;
  receitaPaga: number;
  pago: boolean;
};

/** Carta de cobranças da rota: resumo de tesouraria + lista por paragem com toggle Pago. */
function Cobrancas({ paragens, faturado }: { paragens: ParagemCobranca[]; faturado: number }) {
  const comReceita = paragens.filter((p) => p.receitaPaga > 0);
  const recebido = comReceita.filter((p) => p.pago).reduce((a, p) => a + p.receitaPaga, 0);
  const porReceber = comReceita.filter((p) => !p.pago).reduce((a, p) => a + p.receitaPaga, 0);
  const linhas = comReceita.map((p) => ({ ...p, info: estadoPagamento(p.data, p.pago) }));
  const vencidos = linhas.filter((l) => l.info.estado === "VENCIDO").length;

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Cobranças</h2>
      <p className="mb-3 text-xs text-gray-500">
        Os clientes têm 90 dias (a contar da data da paragem) para pagar. Marque “Pago” quando o
        valor for encaixado. Não afeta o cálculo de custo/lucro.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Faturado</p>
          <p className="text-lg font-bold">{fmtEuro(faturado)}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-xs text-gray-500">Recebido</p>
          <p className="text-lg font-bold text-green-700">{fmtEuro(recebido)}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs text-gray-500">Por receber</p>
          <p className="text-lg font-bold text-amber-700">{fmtEuro(porReceber)}</p>
        </div>
        <div className={`rounded-lg p-3 ${vencidos > 0 ? "bg-red-50" : "bg-gray-50"}`}>
          <p className="text-xs text-gray-500">Vencidos (+90 d)</p>
          <p className={`text-lg font-bold ${vencidos > 0 ? "text-red-700" : ""}`}>{vencidos}</p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-gray-500">Sem valores a cobrar nesta rota.</p>
      ) : (
        <div className="scroll-fade-x overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Cliente</th>
                <th className="th text-right">Valor</th>
                <th className="th">Vence</th>
                <th className="th">Estado</th>
                <th className="th text-right">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="td font-medium">{l.cliente}</td>
                  <td className="td text-right">{fmtEuro(l.receitaPaga)}</td>
                  <td className="td">{fmtData(l.info.dataVencimento)}</td>
                  <td className="td">
                    <EstadoPagamentoBadge estado={l.info.estado} dias={l.info.diasRestantes} />
                  </td>
                  <td className="td text-right">
                    <PagoToggle paragemId={l.id} pago={l.pago} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
