// Camada de agregação por cliente. Reutiliza o motor de cálculo (carregarRotas) e a
// repartição já calculada por rota (RotaCalc.rateio) para obter a rentabilidade por
// cliente de forma exata — o custo de uma rota é partilhado entre os seus clientes.
// Os pagamentos (já pago / por pagar / vencido) vêm da camada de tesouraria (Paragem
// .pago), tal como em Cobranças. Os contactos vêm do modelo Cliente.

import { prisma } from "@/lib/db";
import { carregarRotas } from "@/lib/rotas-service";
import { estadoPagamento } from "@/lib/calc/pagamentos";

export interface ResumoCliente {
  nome: string;
  /** Nº de rotas (viagens) em que o cliente aparece. */
  nVoyages: number;
  receita: number;
  custo: number;
  lucro: number;
  /** lucro / receita (0 se sem receita). */
  margem: number;
  jaPago: number;
  porPagar: number;
  vencido: number;
  ultimaData: Date | null;
  /** Tem ficha de contacto preenchida no modelo Cliente. */
  temContacto: boolean;
}

export interface VoyageCliente {
  idRota: string;
  data: Date;
  receita: number;
  custo: number;
  lucro: number;
  /** Todas as paragens deste cliente nesta rota estão pagas. */
  pago: boolean;
}

export interface ContactoCliente {
  contato: string | null;
  telefone: string | null;
  email: string | null;
  morada: string | null;
  notas: string | null;
}

export interface DetalheCliente {
  nome: string;
  nVoyages: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  jaPago: number;
  porPagar: number;
  vencido: number;
  ultimaData: Date | null;
  voyages: VoyageCliente[];
  /** Lucro atribuído agregado por mês, cronológico. */
  serie: { mes: string; lucro: number }[];
  contacto: ContactoCliente | null;
}

const margemDe = (receita: number, lucro: number) => (receita > 0 ? lucro / receita : 0);

/** Lista de todos os clientes com totais (rentabilidade + tesouraria), ordenada por lucro desc. */
export async function carregarClientes(): Promise<ResumoCliente[]> {
  const [rotas, paragens, contactos] = await Promise.all([
    carregarRotas({}),
    prisma.paragem.findMany({ select: { cliente: true, receitaPaga: true, pago: true, data: true } }),
    prisma.cliente.findMany({ select: { nome: true } }),
  ]);

  const map = new Map<string, ResumoCliente>();
  const obter = (nome: string): ResumoCliente => {
    let c = map.get(nome);
    if (!c) {
      c = {
        nome,
        nVoyages: 0,
        receita: 0,
        custo: 0,
        lucro: 0,
        margem: 0,
        jaPago: 0,
        porPagar: 0,
        vencido: 0,
        ultimaData: null,
        temContacto: false,
      };
      map.set(nome, c);
    }
    return c;
  };

  // Rentabilidade: a partir do rateio por rota (custo partilhado já distribuído).
  for (const rota of rotas) {
    for (const r of rota.rateio) {
      const c = obter(r.cliente);
      c.receita += r.receitaPaga;
      c.custo += r.custoAtribuido;
      c.nVoyages += 1;
    }
  }

  // Tesouraria: a partir do estado de pagamento de cada paragem (igual a Cobranças).
  for (const p of paragens) {
    const c = obter(p.cliente);
    if (p.pago) c.jaPago += p.receitaPaga;
    else {
      c.porPagar += p.receitaPaga;
      if (estadoPagamento(p.data, p.pago).estado === "VENCIDO") c.vencido += p.receitaPaga;
    }
    if (!c.ultimaData || p.data > c.ultimaData) c.ultimaData = p.data;
  }

  const comContacto = new Set(contactos.map((c) => c.nome));
  for (const c of map.values()) {
    c.lucro = c.receita - c.custo;
    c.margem = margemDe(c.receita, c.lucro);
    c.temContacto = comContacto.has(c.nome);
  }

  return [...map.values()].sort((a, b) => b.lucro - a.lucro);
}

/** Detalhe de um cliente: totais, viagens, série mensal e contacto. */
export async function carregarCliente(nome: string): Promise<DetalheCliente | null> {
  const [rotas, paragensCliente, contacto] = await Promise.all([
    carregarRotas({}),
    prisma.paragem.findMany({
      where: { cliente: nome },
      select: { idRota: true, receitaPaga: true, pago: true, data: true },
    }),
    prisma.cliente.findUnique({ where: { nome } }),
  ]);

  // Estado pago por rota: só "pago" se TODAS as paragens do cliente nessa rota o estiverem.
  const pagoPorRota = new Map<string, boolean>();
  for (const p of paragensCliente) {
    const prev = pagoPorRota.get(p.idRota);
    pagoPorRota.set(p.idRota, (prev ?? true) && p.pago);
  }

  // Viagens: a entrada do rateio deste cliente em cada rota onde aparece.
  const voyages: VoyageCliente[] = [];
  for (const rota of rotas) {
    const r = rota.rateio.find((x) => x.cliente === nome);
    if (!r) continue;
    voyages.push({
      idRota: rota.idRota,
      data: rota.dataInicio,
      receita: r.receitaPaga,
      custo: r.custoAtribuido,
      lucro: r.receitaPaga - r.custoAtribuido,
      pago: pagoPorRota.get(rota.idRota) ?? false,
    });
  }
  if (voyages.length === 0) return null;
  voyages.sort((a, b) => b.data.getTime() - a.data.getTime());

  // Série mensal (lucro atribuído), ordenada cronologicamente.
  const serieMap = new Map<string, number>();
  for (const v of voyages) {
    const chave = `${v.data.getFullYear()}-${String(v.data.getMonth() + 1).padStart(2, "0")}`;
    serieMap.set(chave, (serieMap.get(chave) ?? 0) + v.lucro);
  }
  const serie = [...serieMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, lucro]) => {
      const [ano, mes] = k.split("-");
      return { mes: `${mes}/${ano}`, lucro };
    });

  const receita = voyages.reduce((a, v) => a + v.receita, 0);
  const custo = voyages.reduce((a, v) => a + v.custo, 0);
  const lucro = receita - custo;
  const jaPago = paragensCliente.filter((p) => p.pago).reduce((a, p) => a + p.receitaPaga, 0);
  const porPagar = paragensCliente.filter((p) => !p.pago).reduce((a, p) => a + p.receitaPaga, 0);
  const vencido = paragensCliente
    .filter((p) => !p.pago && estadoPagamento(p.data, p.pago).estado === "VENCIDO")
    .reduce((a, p) => a + p.receitaPaga, 0);
  const ultimaData = paragensCliente.reduce<Date | null>(
    (acc, p) => (!acc || p.data > acc ? p.data : acc),
    null,
  );

  return {
    nome,
    nVoyages: voyages.length,
    receita,
    custo,
    lucro,
    margem: margemDe(receita, lucro),
    jaPago,
    porPagar,
    vencido,
    ultimaData,
    voyages,
    serie,
    contacto: contacto
      ? {
          contato: contacto.contato,
          telefone: contacto.telefone,
          email: contacto.email,
          morada: contacto.morada,
          notas: contacto.notas,
        }
      : null,
  };
}
