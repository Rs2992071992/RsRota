import { calcularParagem, coeficienteReal, efetivos, pesoTransportado, type ContextoCalculo } from "./perStop";
import { valorPortagem } from "./lookups";
import type { ParagemInput, RateioCliente, RotaCalc } from "./types";

/** Chave de agrupamento: mesma direção (tipoViagem) e mesmo dia — idRota
 * pode ser reutilizado em rotas multi-dia, por isso o dia entra na chave
 * para não juntar viagens de dias diferentes num só grupo. */
function chaveGrupoPeso(p: ParagemInput): string {
  const dia = p.data ? new Date(p.data).toISOString().slice(0, 10) : "";
  return `${p.tipoViagem}|${dia}`;
}

/**
 * Peso realmente a bordo durante cada troço de uma rota (array paralelo a
 * `paragens`, por índice) — ver o algoritmo comentado em
 * `ParagemInput.pesoEmTransito` (lib/calc/types.ts). Dois mecanismos,
 * aplicados por esta ordem:
 *
 * 1) "Linhas" recolha->entrega ligadas por `faturarCliente`: uma paragem
 *    com `faturarCliente = X` é uma recolha para X; se X também for o
 *    `cliente` de outra paragem desta rota (uma entrega real), essas
 *    paragens formam uma linha só delas, calculada à parte, por
 *    `kmInicial`, **ao longo de toda a rota — sem olhar a direção/dia**.
 *    O material continua a ser da mesma remessa mesmo que só seja
 *    entregue no dia seguinte ou na direção contrária (caso real
 *    encontrado na rota RIC-Tec-eurored). Começa sempre vazia (0) — só
 *    existe o que for apanhado dentro da própria linha.
 * 2) O resto das paragens (fora de qualquer linha): agrupadas por direção
 *    + dia como sempre (`chaveGrupoPeso`) — `idRota` pode ser reutilizado
 *    em rotas multi-dia não relacionadas, por isso o dia continua a
 *    entrar na chave. Ordena por `kmInicial` dentro do grupo (sequência
 *    física real, mesmo critério de `lib/rotas-service.ts::carregarRota`)
 *    e acumula: começa na soma de tudo o que vai ser descarregado no
 *    grupo e vai subtraindo o que sai / somando o que entra a cada
 *    troço. Uma paragem `VAZIO` corta o grupo em segmentos — é o sinal
 *    de que o camião esvaziou ali, o peso não atravessa esse ponto.
 *
 * Grupos/linhas/segmentos de 1 paragem devolvem `undefined` (sem
 * correção — `calcularParagem` cai no peso próprio da paragem,
 * comportamento inalterado — cobre a esmagadora maioria das rotas, incl.
 * HILP01).
 */
export function pesosEmTransito(paragens: ParagemInput[]): (number | undefined)[] {
  const resultado: (number | undefined)[] = paragens.map(() => undefined);

  // 1) Linhas recolha->entrega ligadas por faturarCliente.
  const clientesEntregues = new Set(
    paragens.filter((p) => p.tipoVeiculo !== "VAZIO").map((p) => p.cliente?.trim()),
  );
  const numaLinha = new Set<number>();
  const linhas = new Map<string, number[]>();
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO") return;
    const alvo = p.faturarCliente?.trim();
    if (alvo && clientesEntregues.has(alvo)) {
      if (!linhas.has(alvo)) linhas.set(alvo, []);
      linhas.get(alvo)!.push(i);
      numaLinha.add(i);
    }
  });
  // Junta a própria entrega (a paragem cujo `cliente` é o alvo da linha).
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO" || p.faturarCliente?.trim()) return;
    const nome = p.cliente?.trim();
    if (nome && linhas.has(nome)) {
      linhas.get(nome)!.push(i);
      numaLinha.add(i);
    }
  });

  for (const indices of linhas.values()) {
    if (indices.length < 2) continue;
    const ordenados = [...indices].sort(
      (a, b) => (paragens[a].kmInicial || 0) - (paragens[b].kmInicial || 0),
    );
    let acumulado = 0; // começa vazio — só o que for apanhado na própria linha
    for (const i of ordenados) {
      resultado[i] = acumulado;
      acumulado += (paragens[i].kgCarregados || 0) - (paragens[i].kgDescarregados || 0);
    }
  }

  // 2) Resto das paragens: agrupadas por direção+dia, VAZIO corta em segmentos.
  const porChave = new Map<string, number[]>();
  paragens.forEach((_, i) => {
    if (numaLinha.has(i)) return;
    const chave = chaveGrupoPeso(paragens[i]);
    const indices = porChave.get(chave) ?? [];
    indices.push(i);
    porChave.set(chave, indices);
  });

  for (const indices of porChave.values()) {
    const ordenados = [...indices].sort(
      (a, b) => (paragens[a].kmInicial || 0) - (paragens[b].kmInicial || 0),
    );

    const segmentos: number[][] = [];
    let atual: number[] = [];
    for (const i of ordenados) {
      if (paragens[i].tipoVeiculo === "VAZIO") {
        if (atual.length) segmentos.push(atual);
        atual = [];
      } else {
        atual.push(i);
      }
    }
    if (atual.length) segmentos.push(atual);

    for (const seg of segmentos) {
      if (seg.length < 2) continue; // segmento de 1 -> sem correção
      let acumulado = seg.reduce((s, i) => s + (paragens[i].kgDescarregados || 0), 0);
      for (const i of seg) {
        resultado[i] = acumulado;
        acumulado += (paragens[i].kgCarregados || 0) - (paragens[i].kgDescarregados || 0);
      }
    }
  }

  return resultado;
}

/**
 * Calcula uma rota completa a partir das suas paragens (§4.2).
 * Agrega custos, calcula rentabilidade e o rateio auditável por cliente.
 */
export function calcularRota(
  idRota: string,
  paragens: ParagemInput[],
  ctx: ContextoCalculo,
): RotaCalc {
  // Custos efetivos por paragem (snapshot congelado ou contexto atual).
  const effs = paragens.map((p) => efetivos(p, ctx));
  const pesos = pesosEmTransito(paragens);
  const calc = paragens.map((p, i) => calcularParagem({ ...p, pesoEmTransito: pesos[i] }, ctx));

  // Componentes do custo total da rota.
  const somaCustoParagens = calc.reduce((a, c) => a + c.custoParagem, 0);
  // Noites: nº de noites × valor por noite (congelado por paragem).
  const somaNoites = paragens.reduce(
    (a, p, i) => a + (p.noitesFora || 0) * effs[i].valorNoite,
    0,
  );
  const somaAlimentacao = paragens.reduce((a, p) => a + (p.alimentacao || 0), 0);
  const somaHorasExtraValor = paragens.reduce(
    (a, p, i) => a + (p.horasExtra || 0) * effs[i].valorHoraExtra,
    0,
  );
  const somaPortagensTabela = paragens.reduce(
    (a, p) => a + valorPortagem(p.zonaPortagem, ctx.tabelaPortagens).valor,
    0,
  );

  const custoTotalRota =
    somaCustoParagens +
    somaNoites +
    somaAlimentacao +
    somaHorasExtraValor +
    somaPortagensTabela;

  // Rentabilidade. Margem mínima congelada (primeira paragem; fallback contexto).
  const margemMinima = effs[0]?.margemMinima ?? ctx.params.margemMinima;
  const precoMinimo = custoTotalRota * margemMinima;
  const receitaTotal = paragens.reduce((a, p) => a + (p.receitaPaga || 0), 0);
  const lucro = receitaTotal - custoTotalRota;
  const alerta: RotaCalc["alerta"] = lucro < 0 ? "🔴 PREJUÍZO" : "🟢 OK";

  // ---- Rateio por cliente, separado por segmento (Ida / Volta) ----
  //
  // Cada segmento é ratreado como uma rota à parte: os clientes de um segmento
  // só pagam os troços desse segmento. O custo dos trajetos VAZIO reparte-se
  // 50 % ida / 50 % volta (100 % ao único que tiver troços). Os custos que não
  // estão presos a um troço (noites, alimentação, horas extra, portagens da
  // tabela) repartem-se por TODOS os clientes da rota. A atribuição manual de
  // km do vazio (`rateioManual`) redireciona parte do vazio para clientes
  // específicos, de qualquer segmento.
  //
  // NB: `tipoViagem` que não seja "Volta" cai em "Ida". Uma rota sem
  // entregas/recolhas "Volta" tem só o segmento "Ida" e o resultado é
  // idêntico ao modelo antigo (HILP01 = 1487,73 €).
  type Seg = "Ida" | "Volta";
  const bucketDe = (p: ParagemInput): Seg =>
    String(p.tipoViagem).trim().toLowerCase() === "volta" ? "Volta" : "Ida";
  const chaveCliente = (p: ParagemInput): string =>
    p.faturarCliente?.trim() || p.cliente || "(sem cliente)";
  const coefParagem = (i: number): number =>
    coeficienteReal(
      paragens[i].tipoVeiculo,
      pesoTransportado(paragens[i]),
      effs[i],
      paragens[i].nPaletes || 0,
      paragens[i].volume || false,
      paragens[i].tipoPalete ?? null,
      paragens[i].paleteComprimentoMm ?? null,
      paragens[i].paleteLarguraMm ?? null,
      paragens[i].nMeiasPaletes || 0,
    );

  // 1) Custo por troço, por segmento; VAZIO à parte.
  const custoTrocos: Record<Seg, number> = { Ida: 0, Volta: 0 };
  const temTrocos: Record<Seg, boolean> = { Ida: false, Volta: false };
  let custoVazioBruto = 0;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo === "VAZIO") {
      custoVazioBruto += calc[i].custoParagem;
    } else {
      const b = bucketDe(p);
      custoTrocos[b] += calc[i].custoParagem;
      temTrocos[b] = true;
    }
  }
  const segAtivo = (b: Seg): Seg => (temTrocos[b] ? b : temTrocos.Ida ? "Ida" : "Volta");

  // 2) Atribuição manual dos troços VAZIO (igual a hoje). O bucket é o da
  // paragem VAZIO, mas se esse segmento não tem troços, cai no segmento ativo.
  const manual: { chave: string; bucket: Seg; valor: number }[] = [];
  let custoManualTotal = 0;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo !== "VAZIO" || !p.rateioManual?.length) continue;
    const kmFeitosTroco = calc[i].kmFeitos;
    if (kmFeitosTroco <= 0) continue;
    const somaKm = p.rateioManual.reduce((a, r) => a + (r.km || 0), 0);
    if (somaKm <= 0) continue;
    const fator = somaKm > kmFeitosTroco ? kmFeitosTroco / somaKm : 1;
    const b = segAtivo(bucketDe(p));
    for (const { cliente, km } of p.rateioManual) {
      if (!cliente || km <= 0) continue;
      const valor = calc[i].custoParagem * ((km * fator) / kmFeitosTroco);
      manual.push({ chave: cliente, bucket: b, valor });
      custoManualTotal += valor;
    }
  }

  // 3) Pool do vazio (menos o manual) -> 50/50 se os 2 segmentos têm troços.
  const poolVazio = Math.max(0, custoVazioBruto - custoManualTotal);
  const vazioSeg: Record<Seg, number> = { Ida: 0, Volta: 0 };
  if (temTrocos.Ida && temTrocos.Volta) {
    vazioSeg.Ida = poolVazio / 2;
    vazioSeg.Volta = poolVazio / 2;
  } else if (temTrocos.Ida) vazioSeg.Ida = poolVazio;
  else if (temTrocos.Volta) vazioSeg.Volta = poolVazio;

  // 4) Pool de nível de rota (não presa a nenhum troço).
  const poolNivelRota =
    somaNoites + somaAlimentacao + somaHorasExtraValor + somaPortagensTabela;

  // 5) Coeficiente por cliente, por segmento.
  interface Acum {
    coefIda: number;
    coefVolta: number;
    presIda: boolean;
    presVolta: boolean;
  }
  const acum = new Map<string, Acum>();
  const obterAcum = (chave: string): Acum => {
    let a = acum.get(chave);
    if (!a) {
      a = { coefIda: 0, coefVolta: 0, presIda: false, presVolta: false };
      acum.set(chave, a);
    }
    return a;
  };
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo === "VAZIO") continue;
    const a = obterAcum(chaveCliente(p));
    const coef = coefParagem(i);
    if (bucketDe(p) === "Volta") {
      a.coefVolta += coef;
      a.presVolta = true;
    } else {
      a.coefIda += coef;
      a.presIda = true;
    }
  }
  for (const m of manual) {
    const a = obterAcum(m.chave);
    if (m.bucket === "Volta") a.presVolta = true;
    else a.presIda = true;
  }
  const todos = [...acum.entries()];
  const coefTot = (a: Acum) => a.coefIda + a.coefVolta;
  const somaCoefTot = todos.reduce((s, [, a]) => s + coefTot(a), 0);

  // 6) Distribuição -> linhas por segmento (cada segmento auto-contido).
  const linhas: Record<Seg, Map<string, RateioCliente>> = { Ida: new Map(), Volta: new Map() };
  const linha = (b: Seg, chave: string): RateioCliente => {
    let l = linhas[b].get(chave);
    if (!l) {
      l = { cliente: chave, coefReal: 0, quota: 0, custoAtribuido: 0, receitaPaga: 0, segmento: b };
      linhas[b].set(chave, l);
    }
    return l;
  };
  for (const b of ["Ida", "Volta"] as const) {
    const presentes = todos.filter(([, a]) => (b === "Ida" ? a.presIda : a.presVolta));
    if (presentes.length === 0) continue;
    const coefB = (a: Acum) => (b === "Ida" ? a.coefIda : a.coefVolta);
    const somaCoefB = presentes.reduce((s, [, a]) => s + coefB(a), 0);
    const custoSeg = custoTrocos[b] + vazioSeg[b];
    for (const [chave, a] of presentes) {
      const l = linha(b, chave);
      l.coefReal += coefB(a);
      const fatia = somaCoefB > 0 ? coefB(a) / somaCoefB : 1 / presentes.length;
      l.custoAtribuido += fatia * custoSeg;
      // Fatia da pool de nível de rota: pelo coef total do cliente, alocada a
      // este segmento na proporção coefB/coefTotal (repartida igual se coef 0).
      const pesoNivel = somaCoefTot > 0 ? coefTot(a) / somaCoefTot : 1 / todos.length;
      const nSegs = [a.presIda, a.presVolta].filter(Boolean).length || 1;
      const parte = coefTot(a) > 0 ? coefB(a) / coefTot(a) : 1 / nSegs;
      l.custoAtribuido += pesoNivel * poolNivelRota * parte;
    }
  }
  for (const m of manual) linha(m.bucket, m.chave).custoAtribuido += m.valor;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo === "VAZIO") continue;
    linha(bucketDe(p), chaveCliente(p)).receitaPaga += p.receitaPaga || 0;
  }

  // 7) rateioPorSegmento (só quando há mesmo os 2) + rateio fundido.
  const rateioPorSegmentoRaw: RotaCalc["rateioPorSegmento"] = [];
  for (const b of ["Ida", "Volta"] as const) {
    const ls = [...linhas[b].values()];
    if (ls.length === 0) continue;
    for (const l of ls) if (custoTotalRota > 0) l.quota = l.custoAtribuido / custoTotalRota;
    ls.sort((x, y) => y.custoAtribuido - x.custoAtribuido);
    rateioPorSegmentoRaw.push({
      segmento: b,
      custo: ls.reduce((s, l) => s + l.custoAtribuido, 0),
      clientes: ls,
    });
  }
  const rateioPorSegmento =
    rateioPorSegmentoRaw.length > 1 ? rateioPorSegmentoRaw : undefined;

  const fundido = new Map<string, RateioCliente>();
  for (const seg of rateioPorSegmentoRaw) {
    for (const l of seg.clientes) {
      let f = fundido.get(l.cliente);
      if (!f) {
        f = { cliente: l.cliente, coefReal: 0, quota: 0, custoAtribuido: 0, receitaPaga: 0 };
        fundido.set(l.cliente, f);
      }
      f.coefReal += l.coefReal;
      f.custoAtribuido += l.custoAtribuido;
      f.receitaPaga += l.receitaPaga;
    }
  }
  const clientes = [...fundido.values()];
  for (const c of clientes) if (custoTotalRota > 0) c.quota = c.custoAtribuido / custoTotalRota;

  const kmTotais = calc.reduce((a, c) => a + c.kmFeitos, 0);
  const totalKgCarregados = paragens.reduce((a, p) => a + (p.kgCarregados || 0), 0);
  const totalKgDescarregados = paragens.reduce((a, p) => a + (p.kgDescarregados || 0), 0);
  // Cobre os 2 estilos de palete: legado (volume=true ou tipoVeiculo literal
  // pré-migração) e novo (dimensão própria, 2026-08-28+ — p.volume fica
  // false/vestigial nesse caso, por isso não basta olhar para p.volume).
  // Meias-paletes contam a 0,5 (nunca ocuparam base própria, mas contam para
  // o total transportado).
  const totalPaletes = paragens.reduce(
    (a, p) =>
      a +
      (p.volume ||
      p.tipoVeiculo === "PALETE_120X80" ||
      p.tipoVeiculo === "PALETE_120X100" ||
      (p.paleteComprimentoMm && p.paleteLarguraMm)
        ? (p.nPaletes || 0) + (p.nMeiasPaletes || 0) * 0.5
        : 0),
    0,
  );

  // Datas da rota: a mais antiga (início) e a mais recente (fim) das paragens.
  const tempos = paragens
    .map((p) => (p.data ? new Date(p.data).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const dataInicio = tempos.length ? new Date(Math.min(...tempos)) : new Date();
  const dataFim = tempos.length ? new Date(Math.max(...tempos)) : dataInicio;

  return {
    idRota,
    dataInicio,
    dataFim,
    paragens: calc,
    somaCustoParagens,
    somaNoites,
    somaAlimentacao,
    somaHorasExtraValor,
    somaPortagensTabela,
    custoTotalRota,
    precoMinimo,
    receitaTotal,
    lucro,
    alerta,
    rateio: clientes,
    rateioPorSegmento,
    kmTotais,
    totalKgCarregados,
    totalKgDescarregados,
    totalPaletes,
  };
}

/** Agrupa paragens por ID Rota e calcula cada rota. */
export function calcularRotas(paragens: ParagemInput[], ctx: ContextoCalculo): RotaCalc[] {
  const grupos = new Map<string, ParagemInput[]>();
  for (const p of paragens) {
    const arr = grupos.get(p.idRota) ?? [];
    arr.push(p);
    grupos.set(p.idRota, arr);
  }
  return Array.from(grupos.entries()).map(([idRota, ps]) => calcularRota(idRota, ps, ctx));
}
