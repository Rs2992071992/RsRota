import {
  calcularParagem,
  coeficienteReal,
  efetivos,
  linhasPaleteEfetivas,
  pesoAproximadoCarregadoEfetivo,
  pesoAproximadoDescarregado,
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
 *
 * Genérico em `carregado`/`descarregado` (2026-09+) para poder ser reaproveitado
 * tanto pelo modo por kg (`kgCarregados`/`kgDescarregados`, ver `pesosEmTransito`
 * abaixo) como pelo modo por paletes (`pesoAproximadoCarregado`/`pesoAproximado`,
 * ver `pesosAproximadosEmTransito`) — mesmo algoritmo, sem duplicar a lógica de
 * segmentação/`faturarCliente` (já apanhada 2× em bugs de "conta a dobra", ver
 * tasks/lessons.md 2026-09-04).
 */
function pesosEmTransitoGenerico(
  paragens: ParagemInput[],
  carregado: (p: ParagemInput) => number,
  descarregado: (p: ParagemInput) => number,
): (number | undefined)[] {
  const resultado: (number | undefined)[] = paragens.map(() => undefined);

  // 1) Linhas recolha->entrega ligadas por `faturarCliente` OU, sem ele, pelo
  // próprio `cliente` da recolha (reposicionamento: recolhe e mais tarde
  // entrega o mesmo lote ao mesmo cliente, ex. RIC-Tec-A24 — recolhe em
  // Ges-thc, entrega essas mesmas paletes no fim; mesma regra já aplicada a
  // `totalPaletes`/ocupação, ver tasks/lessons.md 2026-09-11). `clientesEntregues`
  // (solto — qualquer cliente da rota) continua a servir só o `faturarCliente`,
  // como sempre; a ligação por cliente próprio usa `clientesComEntregaReal`
  // (estrito — só clientes com descarregado>0 nesta rota), senão uma recolha
  // solta sem entrega nenhuma excluir-se-ia a si própria (o seu cliente está
  // sempre no set solto).
  const clientesEntregues = new Set(
    paragens.filter((p) => p.tipoVeiculo !== "VAZIO").map((p) => p.cliente?.trim()),
  );
  const clientesComEntregaReal = new Set(
    paragens
      .filter((p) => p.tipoVeiculo !== "VAZIO" && descarregado(p) > 0)
      .map((p) => p.cliente?.trim())
      .filter((x): x is string => !!x),
  );
  // `numaLinha` = "fora do mecanismo 2 (grupo normal)" — mais lato do que só
  // "está dentro de uma linha" (ver `alvosComOrigem` abaixo).
  const numaLinha = new Set<number>();
  const linhas = new Map<string, number[]>();
  const alvosComOrigem = new Set<string>();
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO") return;
    const viaFatura = p.faturarCliente?.trim();
    // Ligação pelo próprio cliente só para recolha PURA — `p.recolha` (não só
    // `descarregado(p) === 0`, que também é verdade para uma ENTREGA vulgar
    // sem peso aproximado registado; sem este `p.recolha`, essa entrega
    // "sem peso" seria mal-interpretada como uma recolha e ligada à entrega
    // seguinte do mesmo cliente — bug real apanhado no diff contra as rotas
    // reais, RIC-Plas-Sonae: 2 entregas a "Plas-Sonae", uma sem peso
    // registado, davam peso em trânsito negativo). Uma MISTA (`p.recolha`
    // true mas com descarregado>0) também não liga pelo próprio cliente — a
    // sua entrega local não tem nada a ver com a sua recolha (lotes
    // diferentes por definição).
    const alvo = viaFatura || (p.recolha && descarregado(p) === 0 ? p.cliente?.trim() : undefined);
    if (!alvo) return;
    const clientesAlvo = viaFatura ? clientesEntregues : clientesComEntregaReal;
    if (!clientesAlvo.has(alvo)) return;
    alvosComOrigem.add(alvo);
    // A origem NUNCA fica no grupo normal, com ou sem linha — o seu carregado
    // tem destino conhecido (não é "reposicionamento" a ficar no mesmo fluxo).
    numaLinha.add(i);
    // Mas só entra mesmo na CONTA da linha se for uma recolha "pura" (nada de
    // seu a descarregar aqui): uma paragem MISTA (descarrega localmente E
    // recolhe para outro cliente) tem o seu descarregado local sem nada a ver
    // com a linha — juntá-lo dava peso negativo/zero à linha (visto como
    // "vazio" no consumo) E escondia o descarregado local, sem nenhuma
    // correção. Fica de fora da conta (mas fora do grupo normal na mesma) ->
    // sem `resultado[i]`, cai no fallback isolado da própria paragem
    // (`pesoAproximadoTransportado`/`pesoParaConsumo`, ver perStop.ts) — o
    // seu peso PRÓPRIO, não o de ninguém mais.
    if (descarregado(p) === 0) {
      if (!linhas.has(alvo)) linhas.set(alvo, []);
      linhas.get(alvo)!.push(i);
    }
  });
  // Junta a própria entrega (a paragem cujo `cliente` é o alvo de uma linha) —
  // sai do grupo normal mesmo que a linha não se tenha formado (todas as
  // origens desqualificadas por serem mistas): o seu descarregado É o que
  // vinha da(s) origem(ns), não deve diluir-se num grupo que já não as inclui.
  // `numaLinha.has(i)` (não só `p.faturarCliente`) exclui qualquer origem já
  // processada acima — incl. uma recolha ligada pelo PRÓPRIO cliente (sem
  // faturarCliente): sem este `numaLinha.has(i)`, essa origem passaria aqui
  // outra vez (o seu próprio `cliente` está em `alvosComOrigem`) e entraria
  // duplicada em `linhas`, com um índice a mais na conta da linha.
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO" || numaLinha.has(i)) return;
    const nome = p.cliente?.trim();
    if (!nome || !alvosComOrigem.has(nome)) return;
    numaLinha.add(i);
    if (linhas.has(nome)) linhas.get(nome)!.push(i);
  });

  for (const indices of linhas.values()) {
    if (indices.length < 2) continue;
    const ordenados = [...indices].sort(
      (a, b) => (paragens[a].kmInicial || 0) - (paragens[b].kmInicial || 0),
    );
    let acumulado = 0; // começa vazio — só o que for apanhado na própria linha
    for (const i of ordenados) {
      resultado[i] = acumulado;
      acumulado += carregado(paragens[i]) - descarregado(paragens[i]);
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
      let acumulado = seg.reduce((s, i) => s + descarregado(paragens[i]), 0);
      for (const i of seg) {
        resultado[i] = acumulado;
        acumulado += carregado(paragens[i]) - descarregado(paragens[i]);
      }
    }
  }

  return resultado;
}

export function pesosEmTransito(paragens: ParagemInput[]): (number | undefined)[] {
  return pesosEmTransitoGenerico(
    paragens,
    (p) => p.kgCarregados || 0,
    (p) => p.kgDescarregados || 0,
  );
}

/**
 * Paralelo a `pesosEmTransito`, mas para o modo de carga por paletes: usa
 * `pesoAproximadoCarregado`/`pesoAproximado` (via os helpers de fallback de
 * `lib/calc/perStop.ts`, que tratam paragens antigas sem o campo novo) em vez
 * de `kgCarregados`/`kgDescarregados`. Mesmo algoritmo — corre sobre TODAS as
 * paragens sem filtrar por modo: uma paragem por kg não preenche
 * `pesoAproximado*` (contribui 0 aqui) e uma paragem por paletes não preenche
 * `kgCarregados`/`kgDescarregados` (contribui 0 em `pesosEmTransito`), por
 * isso os dois nunca se cruzam mesmo numa rota (rara) com os dois modos.
 */
export function pesosAproximadosEmTransito(paragens: ParagemInput[]): (number | undefined)[] {
  return pesosEmTransitoGenerico(paragens, pesoAproximadoCarregadoEfetivo, pesoAproximadoDescarregado);
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
  const pesosAprox = pesosAproximadosEmTransito(paragens);
  const calc = paragens.map((p, i) =>
    calcularParagem({ ...p, pesoEmTransito: pesos[i], pesoAproximadoEmTransito: pesosAprox[i] }, ctx),
  );

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
  // rateio automático abaixo. O que não for coberto pelos km indicados
  // continua a diluir-se automaticamente, como sempre. Nunca deixa uma
  // paragem atribuir mais km do que os que efetivamente fez (escala tudo
  // para baixo se a soma ultrapassar `kmFeitos`).
  const manualPorCliente = new Map<string, number>();
  const custoManualPorVazio = new Map<number, number>(); // índice do VAZIO -> já coberto manualmente
  for (let i = 0; i < paragens.length; i++) {
    const p = paragens[i];
    if (p.tipoVeiculo !== "VAZIO" || !p.rateioManual?.length) continue;
    const kmFeitosTroco = calc[i].kmFeitos;
    if (kmFeitosTroco <= 0) continue;
    const somaKm = p.rateioManual.reduce((a, r) => a + (r.km || 0), 0);
    if (somaKm <= 0) continue;
    const fator = somaKm > kmFeitosTroco ? kmFeitosTroco / somaKm : 1;
    let cobertoNesteVazio = 0;
    for (const { cliente, km } of p.rateioManual) {
      if (!cliente || km <= 0) continue;
      const valor = calc[i].custoParagem * ((km * fator) / kmFeitosTroco);
      manualPorCliente.set(cliente, (manualPorCliente.get(cliente) ?? 0) + valor);
      cobertoNesteVazio += valor;
    }
    custoManualPorVazio.set(i, cobertoNesteVazio);
  }

  // Rateio por cliente (auditável), SEGMENTADO por troço (tipoViagem + dia —
  // mesma chave de `pesosEmTransito`, para não juntar Ida e Volta, nem dias
  // diferentes de uma rota multi-dia com `idRota` reutilizado, num único
  // "bolo"). Dentro de CADA segmento, o custo reparte-se proporcionalmente
  // ao coeficiente de carga de cada cliente, exatamente como sempre — só que
  // agora o cliente da Ida deixa de subsidiar o troço da Volta (e vice-versa).
  // Uma rota de 1 segmento só (o caso comum, sem Ida/Volta) dá exatamente o
  // mesmo resultado de sempre.
  const chaveSegmento = (p: ParagemInput): string => {
    const dia = p.data ? new Date(p.data).toISOString().slice(0, 10) : "";
    return `${p.tipoViagem}|${dia}`;
  };
  // "chave" de faturação (recolha para outro cliente via `faturarCliente`
  // soma-se à quota desse cliente, não à do próprio `cliente` — igual a
  // sempre).
  const chaveCliente = (p: ParagemInput): string => p.faturarCliente?.trim() || p.cliente || "(sem cliente)";
  const coefPorIndice: number[] = paragens.map((p, i) => {
    if (p.tipoVeiculo === "VAZIO") return 0;
    return coeficienteReal(
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
  });

  const indicesPorSegmento = new Map<string, number[]>();
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO") return;
    const seg = chaveSegmento(p);
    (indicesPorSegmento.get(seg) ?? indicesPorSegmento.set(seg, []).get(seg)!).push(i);
  });
  const custoSegmento = new Map<string, number>();
  const coefSegmento = new Map<string, number>();
  for (const [seg, idxs] of indicesPorSegmento) {
    custoSegmento.set(seg, idxs.reduce((s, i) => s + calc[i].custoParagem, 0));
    coefSegmento.set(seg, idxs.reduce((s, i) => s + coefPorIndice[i], 0));
  }

  const custoAutoPorCliente = new Map<string, number>();
  // Parte de custoAutoPorCliente/manualPorCliente que veio de troços VAZIO —
  // ver `RateioCliente.custoVazioAtribuido`.
  const custoVazioPorCliente = new Map<string, number>();
  const somaAuto = (cliente: string, valor: number) =>
    custoAutoPorCliente.set(cliente, (custoAutoPorCliente.get(cliente) ?? 0) + valor);
  const somaVazio = (cliente: string, valor: number) =>
    custoVazioPorCliente.set(cliente, (custoVazioPorCliente.get(cliente) ?? 0) + valor);
  const distribuiParaSegmento = (seg: string, valor: number, comoVazio = false) => {
    const idxs = indicesPorSegmento.get(seg);
    if (!idxs || idxs.length === 0) return;
    const coefTotal = coefSegmento.get(seg) ?? 0;
    const aplicar = (cliente: string, v: number) => {
      somaAuto(cliente, v);
      if (comoVazio) somaVazio(cliente, v);
    };
    if (coefTotal > 0) {
      for (const i of idxs) aplicar(chaveCliente(paragens[i]), (coefPorIndice[i] / coefTotal) * valor);
    } else {
      // Sem nenhum coeficiente no segmento (raro, ex. peso 0 mal registado) ->
      // reparte igualmente pelos clientes presentes.
      for (const i of idxs) aplicar(chaveCliente(paragens[i]), valor / idxs.length);
    }
  };

  // 1) Custo próprio de cada segmento -> proporcional ao coeficiente DENTRO
  // desse segmento (nunca dilui para outro segmento).
  for (const seg of indicesPorSegmento.keys()) {
    distribuiParaSegmento(seg, custoSegmento.get(seg) ?? 0);
  }

  // 2) Cada VAZIO: a parte não coberta manualmente reparte-se 50/50 entre o
  // segmento anterior e o seguinte, na sequência física por km (a mesma
  // segmentação já usada no aviso de sobreocupação) — cada metade
  // proporcional aos clientes DESSE segmento. Um VAZIO interno ao mesmo
  // segmento (sem mudança de tipoViagem/dia) dilui-se só nesse segmento,
  // tal como sempre. Sem nenhum segmento adjacente (ex. o segmento é o
  // próprio troço vazio), o custo não tem para onde ir automaticamente.
  const ordemKm = paragens.map((_, i) => i).sort((a, b) => (paragens[a].kmInicial || 0) - (paragens[b].kmInicial || 0));
  for (let i = 0; i < paragens.length; i++) {
    if (paragens[i].tipoVeiculo !== "VAZIO") continue;
    const custoRestante = calc[i].custoParagem - (custoManualPorVazio.get(i) ?? 0);
    if (custoRestante <= 0) continue;
    const pos = ordemKm.indexOf(i);
    let segAntes: string | null = null;
    for (let k = pos - 1; k >= 0; k--) {
      const idx = ordemKm[k];
      if (paragens[idx].tipoVeiculo !== "VAZIO") {
        segAntes = chaveSegmento(paragens[idx]);
        break;
      }
    }
    let segDepois: string | null = null;
    for (let k = pos + 1; k < ordemKm.length; k++) {
      const idx = ordemKm[k];
      if (paragens[idx].tipoVeiculo !== "VAZIO") {
        segDepois = chaveSegmento(paragens[idx]);
        break;
      }
    }
    if (segAntes && segDepois && segAntes !== segDepois) {
      distribuiParaSegmento(segAntes, custoRestante * 0.5, true);
      distribuiParaSegmento(segDepois, custoRestante * 0.5, true);
    } else if (segAntes) {
      distribuiParaSegmento(segAntes, custoRestante, true); // mesmo segmento (interno) ou só há "antes"
    } else if (segDepois) {
      distribuiParaSegmento(segDepois, custoRestante, true);
    }
  }

  // 3) Custos comuns da rota (noites, alimentação, horas extra, portagem de
  // tabela) — não pertencem a nenhum troço específico, continuam a repartir-se
  // proporcionalmente ao coeficiente de TODA a rota, exatamente como sempre
  // (não fazem parte da segmentação Ida/Volta acima).
  const custosComuns = somaNoites + somaAlimentacao + somaHorasExtraValor + somaPortagensTabela;
  if (custosComuns > 0) {
    const coefTotalRota = coefPorIndice.reduce((s, c) => s + c, 0);
    const clientesRota = new Set(
      paragens.filter((p) => p.tipoVeiculo !== "VAZIO").map((p) => chaveCliente(p)),
    );
    if (coefTotalRota > 0) {
      paragens.forEach((p, i) => {
        if (p.tipoVeiculo === "VAZIO") return;
        somaAuto(chaveCliente(p), (coefPorIndice[i] / coefTotalRota) * custosComuns);
      });
    } else if (clientesRota.size > 0) {
      for (const cliente of clientesRota) somaAuto(cliente, custosComuns / clientesRota.size);
    }
  }

  // Junta a atribuição manual (VAZIO) por cima do automático.
  const porCliente = new Map<string, RateioCliente>();
  const linha = (cliente: string): RateioCliente =>
    porCliente.get(cliente) ?? {
      cliente,
      coefReal: 0,
      quota: 0,
      custoAtribuido: 0,
      custoVazioAtribuido: 0,
      receitaPaga: 0,
    };
  for (const [cliente, valor] of custoAutoPorCliente) {
    const atual = linha(cliente);
    atual.custoAtribuido += valor;
    porCliente.set(cliente, atual);
  }
  for (const [cliente, valor] of custoVazioPorCliente) {
    const atual = linha(cliente);
    atual.custoVazioAtribuido += valor;
    porCliente.set(cliente, atual);
  }
  // Atribuição manual do vazio (rateioManual) — 100 % do valor é "vazio".
  for (const [cliente, valor] of manualPorCliente) {
    const atual = linha(cliente);
    atual.custoAtribuido += valor;
    atual.custoVazioAtribuido += valor;
    porCliente.set(cliente, atual);
  }

  // coefReal (indicador, não entra no cálculo de custo acima) e receitaPaga:
  // somados globalmente por cliente, como sempre — "acima de 1 indica
  // sobrecarga" continua a olhar para a rota toda, não só para um troço.
  for (let i = 0; i < paragens.length; i++) {
    if (paragens[i].tipoVeiculo === "VAZIO") continue;
    const chave = chaveCliente(paragens[i]);
    const atual = linha(chave);
    atual.coefReal += coefPorIndice[i];
    atual.receitaPaga += paragens[i].receitaPaga || 0;
    porCliente.set(chave, atual);
  }

  // Quota final = fração real do custo total que este cliente paga (sempre
  // verdadeiro, com ou sem segmentação/atribuição manual) — Σquota = 1.
  const clientes = Array.from(porCliente.values());
  for (const c of clientes) {
    if (custoTotalRota > 0) c.quota = c.custoAtribuido / custoTotalRota;
  }

  const kmTotais = calc.reduce((a, c) => a + c.kmFeitos, 0);
  const totalKgCarregados = paragens.reduce((a, p) => a + (p.kgCarregados || 0), 0);
  const totalKgDescarregados = paragens.reduce((a, p) => a + (p.kgDescarregados || 0), 0);

  // Recolha cujo lote também é entregue nesta rota: as SUAS paletes não entram
  // nos totais da recolha — já são contadas na paragem de entrega (senão o
  // mesmo lote soma-se a dobra). Dois casos:
  //  a) `faturarCliente` = X: recolha faturada a outro cliente que também tem
  //     uma paragem nesta rota (regra de sempre, mesma de `pesosEmTransito`).
  //  b) recolha PURA (sem entrega própria) cujo próprio `cliente` recebe uma
  //     ENTREGA nesta rota — recolher e mais tarde entregar o mesmo lote ao
  //     mesmo cliente (reposicionamento; ex. RIC-Tec-A24: recolhe 22 em
  //     Ges-thc e entrega essas 22 no fim). Aqui o alvo tem de ter mesmo uma
  //     ENTREGA (não basta aparecer na rota) — senão uma recolha solta
  //     excluir-se-ia a si própria (o seu cliente está sempre na lista).
  const clientesComEntregaTotal = new Set(
    paragens
      .filter((p) => p.tipoVeiculo !== "VAZIO")
      .map((p) => p.cliente?.trim())
      .filter((x): x is string => !!x),
  );
  const temEntrega = (p: ParagemInput): boolean => {
    if (p.tipoVeiculo === "VAZIO") return false;
    const linhas = linhasPaleteEfetivas(p);
    if (linhas.length > 0) {
      const sp: "ENTREGA" | "RECOLHA" = p.recolha ? "RECOLHA" : "ENTREGA";
      return linhas.some((l) => (l.sentido ?? sp) === "ENTREGA");
    }
    return !p.recolha;
  };
  const clientesComEntregaReal = new Set(
    paragens
      .filter(temEntrega)
      .map((p) => p.cliente?.trim())
      .filter((x): x is string => !!x),
  );
  const jaContadaNaEntrega = new Set<number>();
  paragens.forEach((p, i) => {
    if (p.tipoVeiculo === "VAZIO") return;
    const viaFatura = p.faturarCliente?.trim();
    if (viaFatura) {
      if (clientesComEntregaTotal.has(viaFatura)) jaContadaNaEntrega.add(i);
      return;
    }
    const nome = p.cliente?.trim();
    if (p.recolha && !temEntrega(p) && nome && clientesComEntregaReal.has(nome)) {
      jaContadaNaEntrega.add(i);
    }
  });

  // Cobre os 2 estilos de palete: legado (volume=true ou tipoVeiculo literal
  // pré-migração) e novo (dimensão própria, 2026-08-28+ — p.volume fica
  // false/vestigial nesse caso, por isso não basta olhar para p.volume).
  // Meias-paletes contam a 0,5 (nunca ocuparam base própria, mas contam para
  // o total transportado).
  //
  // A dedução de `jaContadaNaEntrega` só pode excluir a PARTE recolhida de uma
  // paragem — nunca a paragem inteira: uma MISTA (descarrega localmente E
  // recolhe para outro cliente) tem uma entrega própria, sem nada a ver com a
  // recolha faturada, que tem sempre de contar. Por linha (`paletes[]`,
  // `sentido` explícito ou o da paragem em fallback — mesma regra de
  // `linhasCargaParagem`); no estilo legado (sem `paletes[]`, sem sentido
  // possível) a paragem é sempre 100% um sentido só, mantém-se a exclusão
  // inteira de sempre.
  const totalPaletes = paragens.reduce((a, p, i) => {
    const linhas = linhasPaleteEfetivas(p);
    const ehPaleteLegado =
      p.volume || p.tipoVeiculo === "PALETE_120X80" || p.tipoVeiculo === "PALETE_120X100";
    if (linhas.length === 0 && !ehPaleteLegado) return a;
    let nBase: number;
    if (linhas.length > 0) {
      const sentidoParagem: "ENTREGA" | "RECOLHA" = p.recolha ? "RECOLHA" : "ENTREGA";
      nBase = linhas.reduce((s, l) => {
        const sentido = l.sentido ?? sentidoParagem;
        if (sentido === "RECOLHA" && jaContadaNaEntrega.has(i)) return s;
        return s + (l.nPaletes || 0);
      }, 0);
    } else {
      if (jaContadaNaEntrega.has(i)) return a;
      nBase = p.nPaletes || 0;
    }
    return a + nBase + (p.nMeiasPaletes || 0) * 0.5;
  }, 0);
  // Peso aproximado descarregado/recolhido (informativo — nunca entra no
  // rateio). Usa os helpers de fallback (não o campo cru) para que uma
  // RECOLHA pura antiga (valor guardado no `pesoAproximado` de antes deste
  // campo se dividir) conte como recolhido, não descarregado. Ao contrário de
  // `totalPaletes` (um total só, a somar entrega+recolha), descarregado e
  // carregado já são 2 totais SEPARADOS (2 cartões distintos) — não há dupla
  // contagem a evitar somando cada um sem exclusão: o mesmo lote pode
  // aparecer uma vez em cada cartão (recolhido aqui, descarregado ali), o que
  // é exatamente o esperado, não um erro.
  const totalPesoAproximado = paragens.reduce((a, p) => a + pesoAproximadoDescarregado(p), 0);
  const totalPesoAproximadoCarregado = paragens.reduce(
    (a, p) => a + pesoAproximadoCarregadoEfetivo(p),
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
    kmTotais,
    totalKgCarregados,
    totalKgDescarregados,
    totalPaletes,
    totalPesoAproximado,
    totalPesoAproximadoCarregado,
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
