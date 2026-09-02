import {
  calcularParagem,
  coeficienteReal,
  efetivos,
  linhasPaleteEfetivas,
  pesoTransportado,
  type ContextoCalculo,
} from "./perStop";
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

  // Atribuição manual de troços VAZIO (opcional, escritório): os km indicados
  // por cliente convertem-se em fração do troço (km/kmFeitos) aplicada ao
  // custoParagem desse troço, entregue diretamente a esse cliente — fora do
  // rateio proporcional abaixo. O que não for coberto pelos km indicados
  // continua a diluir-se automaticamente, como sempre (ver custoProporcional).
  // Nunca deixa uma paragem atribuir mais km do que os que efetivamente fez
  // (escala tudo para baixo se a soma ultrapassar `kmFeitos`).
  const manualPorCliente = new Map<string, number>();
  let custoManualTotal = 0;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo !== "VAZIO" || !p.rateioManual?.length) continue;
    const kmFeitosTroco = calc[i].kmFeitos;
    if (kmFeitosTroco <= 0) continue;
    const somaKm = p.rateioManual.reduce((a, r) => a + (r.km || 0), 0);
    if (somaKm <= 0) continue;
    const fator = somaKm > kmFeitosTroco ? kmFeitosTroco / somaKm : 1;
    for (const { cliente, km } of p.rateioManual) {
      if (!cliente || km <= 0) continue;
      const valor = calc[i].custoParagem * ((km * fator) / kmFeitosTroco);
      manualPorCliente.set(cliente, (manualPorCliente.get(cliente) ?? 0) + valor);
      custoManualTotal += valor;
    }
  }
  const custoProporcional = custoTotalRota - custoManualTotal;

  // Rateio por cliente (auditável). O custo (menos o que já foi atribuído
  // manualmente acima) é repartido de forma proporcional ao coeficiente de
  // carga (peso/capacidade) de cada cliente, NORMALIZADO para somar 100 %.
  // Assim Σ custoAtribuido = custoTotalRota e Σ margem = lucro. Trajetos a
  // vazio (VAZIO ou camião sem carga) não recebem linha própria no loop
  // abaixo: o que não foi atribuído manualmente dilui-se nos clientes reais.
  const porCliente = new Map<string, RateioCliente>();
  let somaCoef = 0;
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    // Só os trajetos a vazio (VAZIO) ficam de fora: são repositionamento, sem
    // cliente a faturar. Qualquer outro tipo participa (mesmo com peso 0 mal
    // registado), para nunca perder um cliente realmente faturado.
    if (p.tipoVeiculo === "VAZIO") continue;
    const coef = coeficienteReal(
      p.tipoVeiculo,
      pesoTransportado(p),
      effs[i],
      p.nPaletes || 0,
      p.volume || false,
      p.tipoPalete ?? null,
      p.paleteComprimentoMm ?? null,
      p.paleteLarguraMm ?? null,
      p.nMeiasPaletes || 0,
      p.paletes ?? null,
    );
    // Recolha para entregar a outro cliente (`faturarCliente` preenchido):
    // atribui o coeficiente a esse cliente em vez do próprio `cliente` — ex.
    // recolha em "Tec-masterferro" faturada a "Tecfil" soma-se à quota da
    // Tecfil, não gera linha própria nem dilui pelos outros clientes da rota.
    const chave = p.faturarCliente?.trim() || p.cliente || "(sem cliente)";
    const atual = porCliente.get(chave) ?? {
      cliente: chave,
      coefReal: 0,
      quota: 0,
      custoAtribuido: 0,
      receitaPaga: 0,
    };
    atual.coefReal += coef;
    atual.receitaPaga += p.receitaPaga || 0;
    porCliente.set(chave, atual);
    somaCoef += coef;
  }
  // Normalização: quota = coefReal / Σcoef. Garde-fou contra divisão por zero
  // (nenhum arrêt participante) — reparte igualmente entre os clientes presentes.
  const clientesProporcional = Array.from(porCliente.values());
  const denom = somaCoef > 0 ? somaCoef : clientesProporcional.length || 1;
  for (const c of clientesProporcional) {
    c.quota = somaCoef > 0 ? c.coefReal / denom : 1 / denom;
    c.custoAtribuido = c.quota * custoProporcional;
  }

  // Soma a atribuição manual (se houver) — cria a linha do cliente se ainda
  // não existir (ex.: um cliente que só aparece via a atribuição manual do
  // vazio, sem nenhuma outra paragem faturada nesta rota).
  for (const [chave, valor] of manualPorCliente) {
    const atual = porCliente.get(chave) ?? {
      cliente: chave,
      coefReal: 0,
      quota: 0,
      custoAtribuido: 0,
      receitaPaga: 0,
    };
    atual.custoAtribuido += valor;
    porCliente.set(chave, atual);
  }

  // Recalcula a quota final de TODOS os clientes a partir do custoAtribuido
  // real (proporcional + manual) — sem override dá exatamente o mesmo valor
  // que o cálculo direto acima (custoManualTotal=0 -> custoProporcional=
  // custoTotalRota), mas mantém "quota = fração real do custo total que este
  // cliente paga" sempre verdadeiro, incl. quando há atribuição manual.
  const clientes = Array.from(porCliente.values());
  for (const c of clientes) {
    if (custoTotalRota > 0) c.quota = c.custoAtribuido / custoTotalRota;
  }

  const kmTotais = calc.reduce((a, c) => a + c.kmFeitos, 0);
  const totalKgCarregados = paragens.reduce((a, p) => a + (p.kgCarregados || 0), 0);
  const totalKgDescarregados = paragens.reduce((a, p) => a + (p.kgDescarregados || 0), 0);
  // Cobre os 2 estilos de palete: legado (volume=true ou tipoVeiculo literal
  // pré-migração) e novo (dimensão própria, 2026-08-28+ — p.volume fica
  // false/vestigial nesse caso, por isso não basta olhar para p.volume).
  // Meias-paletes contam a 0,5 (nunca ocuparam base própria, mas contam para
  // o total transportado).
  const totalPaletes = paragens.reduce((a, p) => {
    const linhas = linhasPaleteEfetivas(p);
    const ehPaleteLegado =
      p.volume || p.tipoVeiculo === "PALETE_120X80" || p.tipoVeiculo === "PALETE_120X100";
    if (linhas.length === 0 && !ehPaleteLegado) return a;
    const nBase =
      linhas.length > 0 ? linhas.reduce((s, l) => s + (l.nPaletes || 0), 0) : p.nPaletes || 0;
    return a + nBase + (p.nMeiasPaletes || 0) * 0.5;
  }, 0);

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
