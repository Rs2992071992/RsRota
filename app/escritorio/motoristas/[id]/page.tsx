import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtData, fmtEuro, fmtNum } from "@/lib/format";
import { carregarEstatisticasMotorista } from "@/lib/motoristas-service";
import MotoristaParamsForm from "./MotoristaParamsForm";
import AlterarPinMotorista from "./AlterarPinMotorista";

export const dynamic = "force-dynamic";

export default async function MotoristaRotas(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const motorista = await prisma.utilizador.findUnique({ where: { id } });
  if (!motorista || motorista.perfil !== "MOTORISTA") notFound();

  const [paragens, stats] = await Promise.all([
    prisma.paragem.findMany({
      where: { motoristaId: id },
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }),
    carregarEstatisticasMotorista(id),
  ]);

  // Agrupa por ID Rota mantendo a ordem (mais recente primeiro).
  const rotas = new Map<string, typeof paragens>();
  for (const p of paragens) {
    const arr = rotas.get(p.idRota) ?? [];
    arr.push(p);
    rotas.set(p.idRota, arr);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/escritorio/motoristas" className="text-sm text-gray-500 hover:underline">
          ← Motoristas
        </Link>
        <h1 className="text-2xl font-bold">
          {motorista.nome || motorista.codigo}{" "}
          <span className="text-base font-normal text-gray-400">({motorista.codigo})</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi rotulo="Km (este ano)" valor={`${fmtNum(stats.kmAnoAtual)} km`} />
        <Kpi rotulo="Kg transportados (este ano)" valor={`${fmtNum(stats.kgAnoAtual)} kg`} />
        <Kpi rotulo="Horas extra (este ano)" valor={fmtNum(stats.horasExtraAnoAtual)} />
        <Kpi rotulo="Noites fora (este ano)" valor={fmtNum(stats.noitesForaAnoAtual)} />
        <Kpi rotulo="Custo motorista (este ano)" valor={fmtEuro(stats.custoTotalAnoAtual)} />
      </div>

      <MotoristaParamsForm
        id={motorista.id}
        inicial={{
          nome: motorista.nome,
          salarioMensal: motorista.salarioMensal,
          seguroMensal: motorista.seguroMensal,
          percentEncargos: motorista.percentEncargos,
          alimentacaoDia: motorista.alimentacaoDia,
          diasAlimentacao: motorista.diasAlimentacao,
          kmAnuais: motorista.kmAnuais,
          fatorAnualizacao: motorista.fatorAnualizacao,
          mostraNoitesFora: motorista.mostraNoitesFora,
          mostraAlimentacao: motorista.mostraAlimentacao,
          mostraHorasExtra: motorista.mostraHorasExtra,
        }}
      />

      <AlterarPinMotorista id={motorista.id} codigo={motorista.codigo} />

      {paragens.length === 0 ? (
        <div className="card text-sm text-gray-500">Este motorista ainda não registou paragens.</div>
      ) : (
        Array.from(rotas.entries()).map(([idRota, ps]) => (
          <div key={idRota} className="card space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Rota {idRota}{" "}
                <span className="text-sm font-normal text-gray-400">· {ps.length} paragem(ns)</span>
              </h2>
              <Link
                href={`/escritorio/rotas/${encodeURIComponent(idRota)}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Abrir rota (analisar/corrigir) →
              </Link>
            </div>
            <ul className="divide-y divide-gray-100 text-sm">
              {ps.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{p.cliente || "(sem cliente)"}</span>
                  <span className="text-xs text-gray-500">
                    {fmtData(p.data)} · {p.tipoVeiculo} · {fmtNum(p.kmFinal - p.kmInicial)} km
                    {p.kgCarregados > 0 ? ` · ${fmtNum(p.kgCarregados)} kg` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="text-lg font-bold">{valor}</p>
    </div>
  );
}
