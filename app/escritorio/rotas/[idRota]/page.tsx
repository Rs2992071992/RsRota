import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { carregarRota } from "@/lib/rotas-service";
import { fmtEuro, fmtNum, fmtNum2 } from "@/lib/format";
import { AlertaBadge } from "@/components/Badge";
import ParagemAcoes from "@/components/ParagemAcoes";
import type { ParagemEditavel } from "@/components/ParagemEditor";

export const dynamic = "force-dynamic";

export default async function RotaDetalhe({ params }: { params: { idRota: string } }) {
  const idRota = decodeURIComponent(params.idRota);
  const [{ rota, paragensRaw }, portagens, parametros, veiculos] = await Promise.all([
    carregarRota(idRota),
    prisma.tabelaPortagem.findMany({ orderBy: { zona: "asc" } }),
    prisma.parametros.findUnique({ where: { id: 1 } }),
    prisma.veiculo.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, matricula: true },
    }),
  ]);
  if (!rota) notFound();

  const zonas = portagens.map((p) => p.zona);
  const valorNoite = parametros?.valorNoite ?? 70;
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
      zonaPortagem: p.zonaPortagem,
      portagensExtra: p.portagensExtra,
      noitesFora: p.noitesFora,
      alimentacao: p.alimentacao,
      horasExtra: p.horasExtra,
      litrosEspanha: p.litrosEspanha,
      custoEspanha: p.custoEspanha,
      receitaPaga: p.receitaPaga,
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/escritorio/rotas" className="text-sm text-gray-500 hover:underline">
            ← Rotas
          </Link>
          <h1 className="text-2xl font-bold">Rota {rota.idRota}</h1>
        </div>
        <AlertaBadge alerta={rota.alerta} />
      </div>

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

      {/* Decomposição do custo da rota */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Decomposição do custo da rota</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm md:grid-cols-3">
          <Item label="Custos das paragens" valor={rota.somaCustoParagens} />
          <Item label="Noites" valor={rota.somaNoites} />
          <Item label="Alimentação" valor={rota.somaAlimentacao} />
          <Item label="Horas extra (valorizadas)" valor={rota.somaHorasExtraValor} />
          <Item label="Portagens (tabela)" valor={rota.somaPortagensTabela} />
          <div className="flex justify-between border-t border-gray-200 pt-2 font-bold md:col-span-3">
            <span>Custo total</span>
            <span>{fmtEuro(rota.custoTotalRota)}</span>
          </div>
        </dl>
      </div>

      {/* Rateio por cliente (auditável) */}
      <div className="card">
        <h2 className="mb-1 font-semibold">Rateio do custo por cliente</h2>
        <p className="mb-3 text-xs text-gray-500">
          Custo atribuído = coeficiente real × custo total da rota ({fmtEuro(rota.custoTotalRota)}). O
          coeficiente é a fração da capacidade ocupada por cada cliente; acima de 1 indica sobrecarga
          (carga superior à capacidade do veículo).
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Cliente</th>
                <th className="th text-right">Coef. real</th>
                <th className="th text-right">Custo atribuído</th>
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
                    <td className="td text-right">{fmtEuro(c.custoAtribuido)}</td>
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

      {/* Paragens detalhadas */}
      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Paragens</h2>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Cliente</th>
              <th className="th">Veículo</th>
              <th className="th text-right">KM</th>
              <th className="th text-right">Peso</th>
              <th className="th text-right">Comb.</th>
              <th className="th text-right">Motorista</th>
              <th className="th text-right">Veículo</th>
              <th className="th text-right">AdBlue</th>
              <th className="th text-right">Port. extra</th>
              <th className="th text-right">Custo paragem</th>
              <th className="th text-right">€/kg</th>
              <th className="th text-right">Receita paga</th>
              <th className="th text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rota.paragens.map((p, i) => (
              <tr key={p.id ?? i}>
                <td className="td font-medium">{p.cliente}</td>
                <td className="td">{p.tipoVeiculo}</td>
                <td className="td text-right">{fmtNum(p.kmFeitos)}</td>
                <td className="td text-right">{fmtNum(p.pesoTransportado)}</td>
                <td className="td text-right">{fmtEuro(p.custoCombustivel)}</td>
                <td className="td text-right">{fmtEuro(p.custoMotorista)}</td>
                <td className="td text-right">{fmtEuro(p.custoVeiculo)}</td>
                <td className="td text-right">{fmtEuro(p.custoAdblue)}</td>
                <td className="td text-right">{fmtEuro(p.portagensExtra)}</td>
                <td className="td text-right font-semibold">{fmtEuro(p.custoParagem)}</td>
                <td className="td text-right">{p.precoPorKg > 0 ? fmtNum2(p.precoPorKg) : "—"}</td>
                <td className="td text-right">{fmtEuro(p.id ? raw(paragensRaw, p.id) : 0)}</td>
                <td className="td text-right">
                  {p.id && editavel(p.id) ? (
                    <ParagemAcoes paragem={editavel(p.id)!} zonas={zonas} veiculos={veiculos} valorNoite={valorNoite} />
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
    </div>
  );
}

function Item({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-600">{label}</span>
      <span className="whitespace-nowrap font-medium">{fmtEuro(valor)}</span>
    </div>
  );
}

function raw(paragens: { id: number; receitaPaga: number }[], id: number): number {
  return paragens.find((p) => p.id === id)?.receitaPaga ?? 0;
}
