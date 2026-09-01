# Lições aprendidas

Formato: [data] | o que correu mal | regra para evitar

- [2026-08-30] | Ao planear uma alteração ao motor de cálculo (rateio por
  segmento Ida/Volta) escrevi que seria um "no-op" para as rotas atuais,
  baseado em que **nenhum teste** (`perRoute.test.ts`) tinha entregas/recolhas
  marcadas `tipoViagem="Volta"` — só paragens VAZIO. O diff contra a BD real
  mostrou **10 das 28 rotas reais** com entregas/recolhas "Volta" (backhauls
  p/ Tecfil) que mudavam de rateio, algumas muito (RIC-Percam: 162→692 €). |
  As fixtures de teste NÃO são amostra representativa de produção, sobretudo
  para campos "de fluxo" que o motorista preenche (tipoViagem, recolha,
  faturarCliente). Antes de afirmar "não afeta nada" / "é retro-compatível",
  correr o cálculo novo vs o antigo sobre **todos os registos reais**
  (`carregarRotas({})` + `git stash` + diff), não só os testes. (Esta feature
  acabou revertida a pedido do Ricardo — mas o diff foi o que evitou a
  surpresa.)

- [2026-08-30] | O motor de empacotamento da planta de carga arrumava só por
  "prateleiras" (filas ao longo da largura, cursor único no comprimento). O
  Ricardo mostrou o carreg. real #9: 11 paletes 1300×1100 num camião 7500×2480
  cabem (faixa de 6 "ao través" 1300mm + faixa de 5 "ao comprido" 1100mm =
  2400≤2480), mas o motor só metia 10 — o modelo de cursor único não exprime
  duas faixas a avançarem a ritmos diferentes. Ao trocar para MaxRects
  (empacotamento 2D verdadeiro) o #9 passou a 11, MAS o #7 (38× 1200×800)
  REGREDIU de 38 para 36: a heurística gulosa do MaxRects quebra a grelha
  uniforme, enquanto as prateleiras (com o fallback de abrir uma fila rasa no
  fim) já a resolviam na perfeição. | Ao substituir um algoritmo heurístico
  central, NUNCA assumir que o novo domina o antigo em todos os casos —
  heurísticas de bin-packing 2D trocam de "melhor" conforme a instância. A
  solução robusta foi `empacotar` correr OS DOIS (prateleiras + MaxRects) e
  devolver o que coloca mais paletes (empate → prateleiras, mais regular e
  estável): "nunca pior do que antes" por construção. Validado com diff
  antes/depois de TODOS os carregamentos reais (#5–#9), não só o caso novo —
  foi o único sítio onde a regressão do #7 apareceu (nem `tsc` nem os testes a
  apanhariam sem o diff contra dados reais).

- [2026-08-30] | A 1ª versão da rotação de paletes na planta de carga
  (`PedidoPalete.orientacao`, commit `13e40ea`) implementou "Ao través"/"Ao
  comprido" como restrição **rígida** em `orientacoesQueCabem` (filtrava a
  orientação não-escolhida). O Ricardo forçou "Ao través" a 10 paletes 1300×1100
  reais (carreg. #9, caixa 7500×2480): como `2×1300 > 2480`, o motor metia 1 por
  fila e deixava 4 sem espaço — quando `1300 + 1100 (rodada) = 2400` cabe na
  largura. Só apanhado quando ele testou com dados reais, não pelos testes (que
  só verificavam "todas rotacionadas"). | Uma preferência de orientação/layout
  imposta pelo utilizador deve ser **preferência com fallback**, nunca uma
  exclusão rígida no passo que decide o que cabe: manter as 2 orientações
  candidatas e só usar a preferência na ordenação (qual tentar primeiro) + numa
  regra de "reservar profundidade da fila para encostar a palete seguinte
  rodada" quando a orientação preferida sozinha não mete 2 lado a lado. Testar
  sempre um caso onde a orientação forçada é geometricamente pior do que a
  automática, não só o caso feliz.

- [2026-08-30] | No upgrade Next.js 14→16, `npx @next/codemod@canary` (a
  ferramenta oficial da Vercel) resolveu-se a si própria para
  `16.4.0-canary.11` — uma versão mais recente/canary do que o `16.3.3`
  (estável) que instalou no projeto. Aplicou 2 transforms de uma feature
  que só existe nessa versão canary, não na 16.3.3 real: `lib/session.ts`
  ganhou um cast para `UnsafeUnwrappedCookies`/`UnsafeUnwrappedHeaders`
  (tipo que não existe no `next/headers` da 16.3.3 — erro de compilação
  imediato), e 30 páginas ganharam `export const instant = false` (opção
  "Cache Components", também inexistente na 16.3.3 — erro de tipos nos
  `.next/types` gerados). Só se detetou porque `tsc --noEmit` correu logo
  a seguir a cada lote de alterações, antes de continuar. | Depois de
  correr um codemod de upgrade (desta ou de outra ferramenta), correr
  sempre `tsc --noEmit` **imediatamente**, antes de aplicar o codemod
  seguinte ou de considerar o lote "aplicado" — a ferramenta pode estar
  numa versão diferente (mais nova) do pacote-alvo real instalado, e
  aplicar transforms para funcionalidades que esse pacote ainda não tem.
  Nunca confiar cegamente no "0 errors" que o próprio codemod reporta —
  isso só significa que o *parsing/transform* não falhou, não que o
  código resultante compila contra a versão instalada.
- [2026-08-30] | O mesmo upgrade só ficou a compilar depois de descobrir que
  o atalho "unsafe" acima nem sequer era válido — a solução correta
  (`cookies()`/`headers()` verdadeiramente assíncronos) tocou ~60
  call-sites de `getSessao()`/`getSessaoInfo()`/`getMotoristaId()`/
  `exigirPerfil()` espalhados por rotas API e páginas. Como todos já
  estavam dentro de funções `async` (convenção já seguida no projeto),
  bastou um script (`grep -rl` + `String.replace` com lookbehind
  `(?<!await )` para ser idempotente) a prefixar cada chamada com
  `await` — 1 função não-async (`app/page.tsx`) foi o único caso a
  corrigir à mão. | Uma alteração de assinatura numa função central
  chamada de dezenas de sítios (aqui: tornar `getSessao()` assíncrona)
  não obriga a editar ficheiro a ficheiro se o padrão de chamada for
  uniforme — um script de substituição com lookbehind negativo (evita
  duplicar `await` em chamadas já corrigidas) trata o grosso em segundos,
  com `tsc` a apanhar os poucos casos que precisam de atenção manual.
- [2026-08-30] | Bug real encontrado ao testar o upgrade (não causado por
  ele): em `app/login/page.tsx`, o `finally` da função `entrar()` repunha
  `aLigar=false` logo a seguir a `router.push(destino)`, sem esperar a
  navegação terminar — o botão ficava clicável de novo enquanto o
  dashboard ainda estava a carregar. Um 2º clique disparava um 2º
  carregamento completo do dashboard em simultâneo (~8 queries cada), e
  dois a competir pela única ligação à BD (`connection_limit=1`,
  serverless) esgotavam-na (P2024), obrigando a recarregar a página à
  mão para conseguir entrar — só reproduzido a testar localmente com BD
  real, nunca em `vitest`. | Um botão que dispara `router.push()` para uma
  página cara (várias queries) só deve voltar a ficar clicável nos
  caminhos de erro — no caminho de sucesso, deixar o estado "a carregar"
  até o componente desmontar com a troca de página. Resolver isto em
  paralelo a otimizar o destino (menos queries) é mais frágil do que
  simplesmente impedir o duplo-clique na origem.

- [2026-08-28] | Ao adicionar a atribuição manual de km de um troço VAZIO
  (`rateioManual`), a forma óbvia de encaixar no rateio existente seria só
  subtrair o valor manual do `custoTotalRota` antes do loop de coeficientes
  e somá-lo depois — mas isso deixava `quota` (campo usado para o mostrar
  na UI) a mentir: continuava a refletir só a fatia proporcional
  (`coefReal/denom`), não a fração REAL do custo total que o cliente
  passava a pagar depois de somar a parte manual. | Sempre que um valor
  "quota"/"%" é mostrado ao lado de um total que pode ter componentes
  manuais + proporcionais, recalcular a quota NO FIM a partir do resultado
  final (`quota = custoAtribuido / custoTotalRota`), nunca a partir da
  fórmula proporcional isolada — garante Σquota=1 sempre, e é
  matematicamente idêntico ao valor antigo quando não há override nenhum
  (confirmado: os 161 testes, incl. os 46 já existentes sobre rateio, não
  mudaram de resultado). Verificado também contra a rota real
  `RIC-Blowtec`: atribuir 100% de um vazio de 69 km a um cliente moveu
  138,28€→149,06€ / 31,61€→20,82€ sem alterar o custoTotalRota (169,88€).

- [2026-08-28] | Ao implementar `nMeiasPaletes` encontrei um bug lateral em
  `totalPaletes` (`lib/calc/perRoute.ts`, métrica agregada da rota): a
  condição só somava `nPaletes` quando `p.volume` ou `tipoVeiculo` literal
  antigo `PALETE_120X80/100` — não cobria o estilo novo por dimensão
  (`paleteComprimentoMm`/`LarguraMm`), introduzido no commit `e27ce00` no
  mesmo dia, onde `p.volume` fica `false`/vestigial de propósito. Rotas 100%
  "estilo novo" mostravam `totalPaletes: 0`, errado — nenhum teste cobria
  isto. Também faltavam `tipoPaleteId`/`paleteComprimentoMm`/`paleteLarguraMm`/
  `pesoAproximado` em `linhaDevisSchema` (`lib/validacao.ts`) — o Zod
  descartava-os silenciosamente ao GUARDAR um orçamento (só estavam no schema
  de ESTIMAR, `estimarDevisSchema`), perdendo o registo desses campos na BD
  sem erro nenhum. | Sempre que um campo/condição passa a ter 2 (ou mais)
  "estilos" válidos (aqui: legado vs. dimensão), fazer uma busca por TODOS os
  outros sítios que já verificavam o estilo antigo isoladamente (`grep` pelo
  campo/condição no repo todo) — não basta atualizar o motor de cálculo
  principal, métricas agregadas e schemas de escrita secundários (ex.:
  guardar vs. estimar um orçamento) ficam facilmente esquecidos e falham em
  silêncio (sem exceção, sem teste a apanhar, só dados a menos).

- [2026-08-28] | Paletes passaram a ser o único modo de rateio (capacidade por
  dimensão em vez de nº fixo por tipo, catálogo `TipoPalete` de 8 tamanhos) e o
  peso aproximado passou a alimentar a tabela de consumos — isto **reverte
  parcialmente** a decisão de 2026-07-17 abaixo ("o peso nem devia entrar no
  registo deste tipo de carga"). Não é uma contradição: em 07-17 o peso era uma
  *sugestão automática* (nº × peso médio) sem o utilizador saber que alimentava
  o consumo — agora é um campo explícito, opcional, pedido conscientemente pelo
  Ricardo para ter uma ideia real do consumo do veículo. Ambas as decisões
  ficam registadas para não se perder o porquê de nenhuma. | Quando uma decisão
  anterior é revertida, não apagar a lição antiga nem fingir que nunca existiu
  — acrescentar uma nova entrada a explicar o que mudou e porquê (aqui: de
  "sugestão automática implícita" para "campo explícito opcional").
- [2026-08-28] | Ao substituir a capacidade de paletes por uma fórmula de área
  (`floor(caixaLargura/paleteLargura) × floor(caixaComprimento/paleteComprimento)`,
  testando as 2 orientações), testei-a à mão contra os 4 pares reais de
  produção (AO-33-PJ/08-SC-33 × paletes 1200×800/1200×1000, somando veículo +
  reboque habitual). 3 em 4 bateram exatamente com os `capacidadePaleteA/B`
  atuais (38/30/36) — mas 08-SC-33 + palete 1200×1000 deu 28 pela fórmula
  contra 24 configurado (+17%), sugerindo que o Frenauf (reboque deste
  veículo) tem alguma perda física real (estrutura, acesso) que a área pura
  não capta. | Nunca confiar cegamente numa fórmula geométrica nova só porque
  bate certo na maioria dos casos — testá-la contra TODOS os casos reais
  disponíveis antes de a considerar validada, e prever uma via de correção
  manual (aqui: `Veiculo.fatorOcupacaoPalete`, default 1) para quando a
  geometria e a realidade física discordam. Ação pendente do Ricardo: decidir
  se ajusta o fator do 08-SC-33 (~0,86 reproduziria os 24 atuais).

- [2026-08-27] | "Application error: a server-side exception has occurred" sempre
  que o Ricardo entrava no escritório (login OK, crash logo a seguir, a
  carregar `/escritorio/dashboard`). Causa: a página do dashboard chamava
  `carregarDashboard()` e `carregarPoupancaEspanha()` em paralelo, e CADA UMA
  chamava internamente `carregarBase()` (7 queries Prisma) — o dashboard
  disparava a mesma carga pesada (paragens + contexto + snapshot) DUAS VEZES,
  mais a `contarVencidos()` do layout, ~15 queries concorrentes. Com
  `DATABASE_URL` em `connection_limit=1` (obrigatório em serverless/Neon
  pooled, ver entrada de 2026-08-12 abaixo), todas essas queries têm de se
  enfileirar por UMA única ligação — o total ultrapassava os 10s do timeout
  do pool e rebentava com `PrismaClientKnownRequestError P2024`, não
  apanhado por try/catch nenhum → crash da Server Component. Só apanhado a
  correr `next build && next start` local ligado à BD de produção (`npm run
  dev` não reproduz bem problemas de connection pool) e a ler os logs do
  servidor — o browser só mostra o "digest", nunca a causa. | Sempre que uma
  página faz `Promise.all` de duas funções de serviço que podem partilhar a
  mesma base de dados cara, verificar se não estão a duplicar o fetch —
  carregar a base UMA vez (`carregarBase()`, agora exportada) e passá-la
  explicitamente às funções (`carregarDashboard(base)`,
  `carregarPoupancaEspanha(base)`) em vez de cada uma ir buscar a sua
  própria cópia. Para depurar "server-side exception" em produção sem acesso
  aos logs do Vercel: `next build && next start` local com o `DATABASE_URL`
  de produção reproduz o mesmo `connection_limit=1` e mostra o stack trace
  completo no terminal.

- [2026-08-22] | Ao analisar a rota real `RIC-Francisco Lince Blowtec`
  (pedido do Ricardo) encontrei `coeficienteCarga: NaN` em 3 paragens de
  paletes — e isso propagava-se ao rateio da rota **inteira**: como
  `somaCoef` ficava `NaN`, a guarda contra divisão por zero
  (`somaCoef > 0 ? ... : clientes.length`) caía sempre no ramo de
  emergência, e os 8 clientes desta rota pagavam todos 12,5% cada,
  ignorando peso/paletes reais (ex.: Blo-sega, 15 paletes, devia pagar
  32,25% e só pagava 12,5%; Blowtec, coeficiente 0,03, devia pagar 1,9% e
  pagava 12,5% às custas dos outros). Causa: `Paragem.snapshot` destas 3
  paragens foi congelado em 2026-07-06 — **antes** de `capacidadePaleteA/B`
  sequer existirem no sistema (só chegou a 14/07, ver entrada de
  2026-07-14 abaixo) — por isso o snapshot não tinha esses campos, e
  `efetivos()` devolvia o snapshot congelado tal e qual, sem preencher os
  campos em falta: `nPaletes / undefined` = `NaN`. | Sempre que se
  acrescenta um campo novo a `ParagemSnapshot` (histórico congelado por
  paragem), lembrar que snapshots antigos, gravados antes desse campo
  existir, **nunca o vão ter** — não é hipotético, aconteceu na prática 5
  semanas depois. `efetivos()` (`lib/calc/perStop.ts`) passou a fazer
  sempre `{ ...defaultsDoContextoAtual, ...snapshotCongelado }` em vez de
  devolver o snapshot isolado — os valores congelados continuam a
  prevalecer onde existirem (histórico estável, inalterado), só os campos
  em falta é que caem no contexto atual. Verificado: só esta 1 rota tinha
  impacto real (paragens de paletes com snapshot incompleto); outras 44
  paragens tinham o mesmo snapshot incompleto mas, por serem de peso (não
  paletes), nunca tocavam nos campos em falta — ficaram protegidas pela
  mesma correção, sem precisar de nenhum backfill de dados.

- [2026-08-22] | `pesosEmTransito()` (peso em trânsito) agrupava só por
  `tipoVeiculo+dia`, com dois efeitos indesejados encontrados ao analisar
  a rota real `RIC-Tec-eurored` (2 dias, sem `VAZIO` entre eles): (1)
  `VAZIO` era só excluído do grupo em que caía, não separava o que estava
  antes/depois — duas entregas reais no mesmo dia/direção, com um `VAZIO`
  a meio (camião esvaziou), ficavam incorretamente somadas no mesmo
  cálculo de peso; (2) uma recolha feita num dia (ex.: Tec-junqueira, 40kg
  faturados à Tecfil) só entregue no dia seguinte, já noutra direção
  (Volta), ficava com o peso subestimado num troço e sobrestimado noutro,
  porque o corte por dia/direção nunca sabe que o material continua a ser
  da mesma remessa. Tentei corrigir (2) juntando dias/direções
  consecutivas sem `VAZIO` entre elas — **não funciona**: infla paragens
  de um dia com entregas de outro dia que nada têm a ver (testado à mão:
  o peso da 1ª paragem do dia 1 subia de 13215kg certos para 18001kg
  errados). | Tornar `VAZIO` uma fronteira real (corta o grupo em
  segmentos, já não é só excluído) resolve (1) sem qualquer efeito
  colateral. Para (2), a chave estava em usar um sinal que o sistema já
  trata como verdade para a faturação — `Paragem.faturarCliente` — para
  ligar a(s) recolha(s) à entrega correspondente numa "linha" à parte,
  calculada ao longo de **toda a rota** (ignora dia/direção), começando
  sempre vazia (0 kg, só o que for apanhado dentro da própria linha).
  Nunca tentar "resolver" isto achatando `Paragem.data` para a mesma data
  em toda a rota — a data também alimenta o prazo de pagamento (90 dias,
  Cobranças) e os relatórios por dia, e desalinhar isso para contornar um
  problema de estimativa de combustível troca um problema pequeno por um
  maior. Verificado com números reais (não só os testes): a linha
  Tec-junqueira→Tec-Viveres-ferry→Tec-masterferro→Tec-A2→Tecfil passou a
  dar 0/40/1840/2772/3772 kg (fisicamente correto), e o resto da rota
  ficou praticamente inalterado (diferença de 0,05 € no total, dentro do
  mesmo escalão de consumo).

- [2026-08-22] | `capacidadePaleteA`/`B` (ocupação de paletes) só tinham UM
  valor por veículo, calibrado a pensar em camião+reboque — ao contrário
  do peso, que já distingue `capacidadeCamiao` vs `capacidadeReboque`
  consoante o Tipo Veículo escolhido. Um motorista a ir só de camião (sem
  reboque) carregado de paletes tinha a ocupação sistematicamente
  subestimada (18 paletes num camião sozinho, a 100% da capacidade real,
  calculava 18/38≈47%). Só foi apanhado porque o Ricardo deu um exemplo
  concreto ("fui só com o camião... 18 e 14 pl") e se perguntou se a
  percentagem batia certo — não havia teste nenhum a cobrir esta
  combinação porque `PALETE_120X80`/`PALETE_120X100` eram valores do
  próprio `tipoVeiculo`, sem forma de o cruzar com "tem ou não reboque". |
  Sempre que um par capacidade-A/capacidade-B (ou equivalente) for
  introduzido para um tipo de carga alternativo (paletes, volume, etc.),
  perguntar explicitamente se essa capacidade muda consoante outra
  dimensão já existente no modelo (aqui: se leva reboque) — não assumir
  que um único número chega só porque "funcionou até agora". A correção
  ficou mais simples por já existir o precedente exato a copiar
  (`capacidadeCamiao`/`capacidadeReboque`): tornar o novo atributo
  ortogonal ao existente (`Paragem.volume`+`tipoPalete`, em vez de
  `tipoVeiculo=PALETE_*` a substituir o tipo de veículo real) em vez de
  inventar mais um valor de enum, e migrar dados antigos com um fallback
  de compatibilidade no motor (não só um script) para o deploy do código
  e o backfill poderem correr em qualquer ordem sem janela de cálculo
  errado. Verificado com snapshot antes/depois via `carregarRota()` nas 7
  rotas reais afetadas — zero diferenças, antes de sequer tocar em dados
  de produção com o `updateMany`.

- [2026-08-16] | Auditoria de segurança pedida pelo Ricardo (a pensar em vender a
  app a mais empresas) encontrou 4 falhas reais, todas corrigidas no mesmo
  commit: (1) `PATCH /api/paragens/:id` só validava **de quem** era a
  paragem, não **que campos** podiam ser alterados — um motorista
  autenticado conseguia mudar `pago`/`receitaPaga`/`faturarCliente` por API
  direta, campos que a UI só esconde do motorista por cosmética
  (`ParagemEditor.tsx`/`PagoToggle.tsx`); (2) `/api/auth/login` sem limite de
  tentativas, com PINs de 4 dígitos (10 000 combinações) brute-forçáveis;
  (3) `lib/auth.ts` comparava a assinatura HMAC com `!==` (não constant-time)
  e caía silenciosamente no segredo de dev (público no GitHub) se
  `AUTH_SECRET` faltasse em produção; (4) `next@14.2.15` tinha o CVE-2025-29927
  (bypass de autorização em middleware) por corrigir. | Sempre que um campo só
  é escondido na UI por perfil (não por regra de negócio genuína), assumir
  que a API tem de repetir essa restrição — a UI nunca é a fronteira de
  autorização. Em qualquer login por PIN/password curto, bloqueio de conta
  por tentativas falhadas é não-negociável, não "boa prática opcional".
  **Trade-off aceite conscientemente**: o bloqueio de conta é por `codigo`
  (5 falhas → 15 min), não por IP — como o escritório é uma conta única de
  `codigo` fixo ("ESCRITORIO"), alguém que saiba isso pode manter essa conta
  perpetuamente bloqueada só a errar o PIN de propósito a cada 15 min (nega
  acesso ao dono, não expõe dados). Fora de âmbito nesta ronda, por
  precisarem de teste dedicado antes de ir para produção: upgrade major do
  Next.js (14→16, corrige as restantes CVEs mas exige React 19 + testar
  Server Actions) e troca do pacote `xlsx` (prototype pollution/ReDoS sem
  fix, usado em `/api/importar` — só o escritório o usa hoje, mas o risco
  cresce se houver mais admins de mais empresas).

- [2026-08-13] | `DATABASE_URL` em produção (Vercel) apontava desde sempre para a
  ligação **direta** da Neon (hostname sem `-pooler`), nunca para a "Pooled
  connection". Sintoma real reportado pelo Ricardo: erro 500 ao registar uma
  paragem pela app Motorista — e ao tentar de novo, a paragem **já estava
  gravada** (a escrita chegou a completar-se na BD, mas a função serverless da
  Vercel não conseguiu devolver a resposta a tempo/de forma fiável). Não
  reproduzido por `tsc`/testes/build — só visível em produção, sob a
  ligação direta, que esgota/atrasa em serverless porque cada invocação da
  Vercel abre a sua própria ligação à Neon. | Em qualquer stack
  Next.js/Prisma + Vercel (serverless) + Neon, `DATABASE_URL` (runtime) TEM de
  ser a connection string com **pooling** (pgbouncer, hostname `-pooler`,
  com `pgbouncer=true&connection_limit=1`); a ligação direta só deve ser usada
  em `directUrl` no `datasource` do `schema.prisma`, exclusiva para
  `prisma db push`/`migrate` (DDL não passa de forma fiável pelo pooler em
  modo transaction). Validado com 3 pedidos reais seguidos contra a produção
  (todos 201) depois da troca — dados de teste apagados a seguir.

- [2026-08-12] | 2ª vez que um cabeçalho com nome+separadores+"Sair" numa
  única linha (`flex justify-between`, sem quebra) corta o botão Sair em
  ecrãs estreitos — a 1ª foi o menu do escritório (corrigido com
  hambúrguer), agora o do motorista a 320px (só 3 separadores + nome já
  chegava para cortar). Desta vez apanhado ANTES de o Ricardo reportar,
  testando a 320/360px com Playwright antes de dar a feature como
  pronta. | Sempre que um cabeçalho `max-w-md`/mobile-first ganha mais um
  separador (nav link, botão), testar a 320px explicitamente — é a
  largura mínima realista (não assumir que "cabe" só porque cabe no
  ecrã de desenvolvimento). Layout de 2 linhas (identidade+ação numa,
  navegação na outra) resolve de forma duradoura, sem precisar de
  hambúrguer para só 3-4 itens.

- [2026-08-12] | Ao gerar o keystore novo do projeto `app-motorista-android`
  (`keytool -genkeypair`), (1) um `-dname` com campos vazios
  (`L=,, S=,,`) rebenta com `IOException: empty AVA in RDN`; (2) o
  formato PKCS12 (default do keytool moderno) não aceita `storePassword`
  diferente de `keyPassword` — ignora silenciosamente o `-keypass` e usa
  sempre o `-storepass` para os dois, com um aviso fácil de perder no
  meio do output. | No `-dname`, omitir por completo os campos que não
  se querem preencher (não deixar `X=,`); gerar sempre UMA password só e
  usá-la para `storePassword` e `keyPassword` em `keystore.properties`,
  não duas diferentes.
- [2026-08-12] | Testar uma app Vite (`app-motorista-android`) contra a
  API real em `npm run dev` (porta 5173) batia direto num 403 de CORS —
  a allowlist da API (`APP_ORIGINS_PERMITIDAS`) cobre as origens do
  Capacitor empacotado (`capacitor://localhost`, etc.), não
  `http://localhost:5173` (porta incluída no `Origin`). | Configurar um
  proxy no `vite.config.ts` (`server.proxy: { '/api': { target: '<API
  real>', changeOrigin: true } }`) e chamar sempre caminhos relativos
  (`/api/...`) em dev — o browser deixa de ver um pedido cross-origin, o
  Vite é que reencaminha server-side. Em produção (`.env.production`
  com `VITE_API_BASE` absoluto) a app fala direto com a API, já dentro
  da allowlist real.
- [2026-08-12] | O template atual do `npm create vite -- --template
  react-ts` vem com TypeScript 6 e a flag `erasableSyntaxOnly` ativa —
  rejeita sintaxe só-TypeScript que não é "apagável" 1:1 para JS, como
  parameter properties (`constructor(public status: number)`), mesmo
  sendo válida em todos os `tsconfig` anteriores. | Em projetos Vite
  novos, evitar parameter properties nos construtores — declarar o campo
  à parte (`status: number;` + `this.status = status` no construtor).
- [2026-08-12] | Sem `chromium-cli` nem Playwright com browsers próprios
  instalados, testar a UI de uma app nova (login, formulário, submissão
  real) parecia exigir uma instalação pesada. | O Chrome/Edge do próprio
  Windows já servem: `npm install -D playwright` (só a lib, sem baixar
  browsers) e `chromium.launch({ executablePath: "C:/Program
  Files/Google/Chrome/Application/chrome.exe" })` — controla o Chrome
  já instalado, sem download nenhum. Combinado com injetar a sessão
  diretamente no `localStorage` (mesma chave que o
  `@capacitor/preferences` usa no browser: `CapacitorStorage.<chave>`),
  dá para testar ecrãs autenticados sem saber o PIN real.

- [2026-08-12] | A diagnosticar um 403 da API da TollGuru, o 1º pedido direto
  (fora da app) teve sucesso; pedidos seguintes passaram todos a dar 403.
  Concluí (errado) que era o `User-Agent` do fetch do Node — troquei o UA
  num 2º pedido, voltou a dar 403, "confirmei" a teoria com só 2 pontos de
  dados, sem controlar a variável tempo. Só ao fazer mais um pedido limpo é
  que a TollGuru devolveu a mensagem real: `"exceeded daily quota of 15
  transactions"` — plano trial (email pessoal) esgotado pelos meus próprios
  testes em sequência. | Ao diagnosticar erros intermitentes de uma API
  externa (sobretudo em contas trial/gratuitas), verificar sempre quota/rate
  limit ANTES de mudar variáveis e "confirmar" teorias — 2 pedidos em
  minutos não isolam nada se a causa real for o número de pedidos em si.
  Ler a mensagem de erro completa do corpo da resposta (não só o código
  HTTP) antes de teorizar — a TollGuru já dizia a causa exata na 1ª vez que
  o corpo da resposta foi mesmo lido.
- [2026-08-12] | `lib/portagens.ts` (`calcularPortagem`) já tinha sido
  desenhada em 2026-06-11 para nunca bloquear o orçamento se a TollGuru
  falhar (chave em falta/expirada, erro de rede, HTTP não-200 — tudo
  devolve `{km:null, tollEur:null, erro}` e `estimar/route.ts` usa isso só
  como aviso, nunca como bloqueio). Isto pagou-se sozinho quando o Ricardo
  pediu para garantir que a app sobrevive ao fim do trial gratuito (14
  dias, sem orçamento para plano pago) — a resposta foi "já está garantido,
  zero alterações". | Ao integrar uma API paga/com quota como accessório
  (não essencial), desenhar a resiliência ANTES de a chave existir sequer
  (fallback sempre testável sem a chave) poupa exatamente este tipo de
  pergunta depois — a integração deve poder ser desligada a qualquer
  momento (quota esgotada, trial a expirar, conta cancelada) sem tocar em
  código nenhum.

- [2026-08-11] | `lib/portagens.ts` (integração TollGuru, escrita em 2026-06-11
  sem chave disponível para testar) enviava o tipo de veículo como campo solto
  `vehicleType` no corpo do pedido. O Ricardo partilhou o schema OpenAPI oficial
  (`toll-api-openapi-schema.json`) antes de configurar a chave na Vercel — o
  schema real do endpoint `origin-destination-waypoints` (truck) exige
  `vehicle: { type }` **aninhado**, e o corpo tem `additionalProperties:
  false`. Sem isto ter sido apanhado agora, a chave ficaria configurada e a
  app pareceria "a funcionar" (200 OK, sem erro), mas calculava portagens
  para o veículo por defeito (carro), não para o camião real — um bug
  silencioso, só visível comparando valores manualmente. | Ao escrever
  integração contra uma API externa sem chave/sandbox disponível para testar
  de verdade, documentar isso explicitamente (aqui devia ter ficado um aviso
  "nunca testado contra a API real") e, assim que uma chave ou schema oficial
  aparecer, validar campo a campo ANTES de dar a integração como pronta — não
  basta o código compilar e "parecer razoável" com base em memória da API.

- [2026-08-11] | A app tinha login por PIN desde o início (2026-06), mas
  nunca ganhou forma de o **mudar** depois de criado — só `POST
  /api/motoristas` definia um PIN, na criação. Resultado: confirmado por
  leitura direta da BD que, meses depois, o escritório e o único motorista
  ainda usavam os PINs por defeito (1234/0000) em produção, sem ninguém dar
  por isso porque nada na app avisava. | Qualquer credencial com valor por
  defeito conhecido (PIN, password inicial, chave de API de exemplo) precisa
  de um caminho explícito para ser trocada, não só um caminho para ser
  criada — decidir isso no momento em que o login é implementado, não depois
  de alguém perguntar "isto já está seguro?". Testado o fluxo todo (alterar
  → login com o novo → repor o original → login de novo) por `curl` com uma
  cookie de sessão forjada por HMAC (mesmo `AUTH_SECRET` do `.env`) contra o
  servidor local — permite validar mutações reais em produção (mesma BD)
  sem depender do PIN real, desde que se restaure o valor original a seguir.

- [2026-08-11] | `Pneu` tem `veiculoId` opcional (`null` = template global
  em Parâmetros; preenchido = pertence a um veículo, editado em Veículos).
  `app/escritorio/parametros/page.tsx` fazia `prisma.pneu.findMany({
  orderBy... })` **sem** `where: { veiculoId: null }` — carregava os pneus
  de TODOS os veículos e mostrava-os juntos com o template, parecendo
  "duplicados" (cada eixo com 2+ valores, um por camião). Pior: como
  `PUT /api/parametros` grava sempre com `veiculoId: null` o que estiver
  no array enviado, gravar a partir desta página com a lista poluída
  visível escrevia os valores dos veículos para dentro do template global
  (nunca apagava os originais por veículo, só ia acumulando cópias no
  template) — encontrado porque o template tinha exatamente `nVeiculo1 +
  nVeiculo2 - interseção` linhas, a assinatura clássica de uma UNION
  acidental. | Sempre que um modelo tem uma FK opcional a servir de
  "âmbito" (global vs por-dono), toda a query de listagem **tem de
  filtrar esse âmbito explicitamente** — nunca confiar que "não há
  veículos a mais no ecrã" só porque a UI não mostra uma coluna de
  dono. Convém também um teste/smoke-check simples (contagem de linhas
  por `veiculoId`) sempre que o utilizador reportar "demasiadas linhas
  repetidas" numa tabela editável ligada a uma FK opcional.

- [2026-08-11] | A app Android "RsRota — Administração" (`capacitor.config.json`,
  `server.url`) abre diretamente em `/escritorio`, um caminho sem `page.tsx`
  próprio (só existem sub-páginas: `/escritorio/dashboard`, `/escritorio/rotas`,
  etc.). O `middleware.ts` só redirecionava quem **não** tinha sessão (para
  `/login`) — quem já estava autenticado (cookie de sessão persistida entre
  aberturas da app, o comportamento que se queria) caía num 404 puro do
  Next.js, sem nenhum `catch-all`/`not-found` a apanhar. Reportado pelo
  Ricardo como "ao ligar dá erro 404" depois de já ter feito login uma vez.
  | Sempre que um `server.url`/deep-link externo aponta para um caminho
  "pasta" (`/escritorio`, `/motorista`) que só tem `layout.tsx` e nenhum
  `page.tsx` seu, o middleware tem de redirecionar esse caminho exato para
  o home do perfil **também no caso autenticado**, não só no caso
  sem-sessão — testado forçando uma cookie assinada localmente (HMAC com
  `AUTH_SECRET`) contra `curl`, sem precisar de saber o PIN real.

- [2026-08-11] | Setup do toolchain Android (projeto irmão
  `app-administracao-android`) neste Windows: (1) `local.properties` com
  `sdk.dir=C:\Android\sdk` (barra invertida) corrompe o caminho — ficheiros
  `.properties` tratam `\` como carácter de escape, e `\A`/`\s` não são
  sequências válidas. Erro resultante ("sintaxe do nome do ficheiro...
  incorreta") só aparece a meio do build (`compileDebugJavaWithJavac`), não
  na leitura do ficheiro. (2) Capacitor 8.x/AGP atual exige **JDK 21**, não
  chega o 17 (erro "invalid source release: 21"). | Em `local.properties`
  do Android, usar sempre `/` no `sdk.dir` (funciona igual no Windows,
  evita todo o problema de escape). Instalar JDK 21 (Temurin) antes de
  qualquer build Capacitor/Android novo — `winget install --id
  EclipseAdoptium.Temurin.21.JDK`. `capacitor.config.ts` também falhou
  neste ambiente (Node a tentar carregar como ESM/CJS incorretamente,
  "Unexpected token 'export'") — usar `capacitor.config.json` evita o
  problema todo, sem perda de funcionalidade para configs simples (sem
  lógica dinâmica).

- [2026-08-06] | O dropdown de Cliente do orçamento (feature do mesmo dia,
  cliente por dropdown) usava `prisma.cliente.findMany()` — a tabela
  `Cliente` só tem uma linha quando alguém preenche a ficha de contacto
  (`ContatoCliente`/`EditarNomeCliente`). A maioria dos clientes reais só
  existe como string em `Paragem.cliente`/`Devis.cliente` (nunca ganharam
  ficha), por isso não apareciam na lista — o Ricardo reportou "deveria
  aparecer a lista dos nossos clientes" comparando com o separador Clientes,
  que usa uma fonte diferente. | Para "todos os clientes conhecidos pela
  app" (não só quem tem ficha), usar `listarNomesClientes()` (união
  Paragem+Devis+Cliente, já existia em `lib/clientes-service.ts` para
  `/escritorio/clientes/agrupar`) ou o `carregarClientes()` usado no
  separador Clientes — nunca assumir que `prisma.cliente.findMany()` sozinho
  é "a lista de clientes" da app. Criado `listarClientesParaOrcamento()`
  (mesma união + contactos da ficha para autofill) e usado nas 2 páginas de
  orçamento em vez da query direta à tabela `Cliente`.
- [2026-08-06] | `npm run build` (`prisma generate && next build`) falhava
  sempre com `EPERM: operation not permitted, rename
  ...query_engine-windows.dll.node.tmpNNNN -> ...query_engine-windows.dll.node`
  neste ambiente Windows, mesmo sem nenhum `next dev`/processo a escutar
  portas 3000/3001 (havia vários `node.exe` residuais a segurar o handle). |
  Quando a alteração **não toca no `prisma/schema.prisma`**, `prisma
  generate` é desnecessário — correr `npx next build` diretamente (salta o
  generate) para validar a build sem depender de destrancar o `.dll`. Só
  investigar/matar processos node residuais se o schema tiver mesmo mudado
  (nesse caso o client tem de ser regenerado).

- [2026-08-06] | `EditarNomeCliente` (`components/EditarNomeCliente.tsx`)
  guardava o nome editável em `useState(nome)`. Como o componente não
  desmonta ao trocar de cliente selecionado (só o prop `nome` muda), o
  React reaproveitava a instância e `novoNome`/`aEditar` ficavam presos ao
  valor do cliente anterior — abrir "editar" noutro cliente mostrava o
  nome que tinha ficado da edição anterior. | Sempre que um componente
  client-side guarda em `useState` um valor inicializado a partir de um
  prop que pode mudar sem desmontar (troca de seleção numa lista/detalhe),
  passar `key={prop}` no pai para forçar remount e reset limpo do estado,
  em vez de `useEffect` a sincronizar manualmente. Aplicado em
  `app/escritorio/clientes/page.tsx:104` (`key={detalhe.nome}`).

- [2026-08-06] | O motor de custo calculava o consumo de combustível de
  cada paragem só a partir do peso próprio dessa paragem
  (`pesoTransportado = max(kgCarregados, kgDescarregados)`), ignorando que
  numa rota com vários clientes o camião vai fisicamente mais pesado nos
  primeiros troços (ainda leva a carga dos clientes seguintes) e mais leve
  nos últimos. Confirmado com dados reais (`RIC-A22`): os `kgDescarregados`
  por troço não formam nenhuma progressão, são só o valor próprio de cada
  cliente — o consumo de cada troço estava a ser calculado com o peso
  errado sempre que uma rota tinha mais do que 1 paragem na mesma
  direção/dia. | Acrescentado `pesoEmTransito` opcional a `ParagemInput`
  (`lib/calc/types.ts`) + `pesosEmTransito()` em `lib/calc/perRoute.ts`,
  que agrupa paragens por `idRota`+`tipoViagem`+dia (multi-dia reutiliza o
  mesmo `idRota`), ordena por `kmInicial` (sequência física real) e
  acumula: começa na soma do que vai ser descarregado no grupo e vai
  subtraindo/somando a cada troço. Só entra no cálculo do consumo — o
  rateio entre clientes (`coeficienteReal`) e `coeficienteCarga` continuam
  a usar o peso próprio de cada paragem (confirmado com o Ricardo:
  "cada cliente paga pelo que é dele, só o custo total da rota fica mais
  exato"). Grupos de 1 paragem (a esmagadora maioria, incl. o caso de
  referência HILP01) ficam matematicamente inalterados — parâmetro
  opcional com fallback, mesma técnica já usada para `nPaletes` em
  `coeficienteReal`. Sem peso "congelado" em `Paragem.snapshot`, por isso
  a correção aplica-se também a rotas antigas (confirmado com o Ricardo,
  mesmo princípio já usado nas tabelas de portagem). Validado à mão contra
  a RIC-A22 real via script `tsx` (consumo passou de valores sem padrão
  para uma descida limpa 35→28→28→28→25→25→25→25 L/100km ao longo do dia),
  e com testes novos que fixam os números exatos (não só invariantes do
  rateio, que passavam mesmo sem a correção estar a funcionar).

- [2026-08-04] | No modelo `Carregamento`/`PedidoPalete`/`TipoPalete` (feature
  Cargas), o catch `e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2003"` para apagar um registo com `onDelete: Restrict` **não
  disparava em Postgres** — a violação `RESTRICT` nativa do Postgres lança
  SQLSTATE `23001` (restrict_violation), que o Prisma embrulha como
  `PrismaClientUnknownRequestError` genérico, não como o P2003 "conhecido"
  (isso só acontece quando é o próprio motor do Prisma a emular a
  restrição). Resultado: 500 em vez do erro amigável 409, só detetado ao
  testar a apagar contra a BD real (não pelos testes unitários/tsc/build). |
  Criado `lib/prisma-errors.ts::ehErroFkRestricao()` que aceita tanto P2003
  como `PrismaClientUnknownRequestError` com `23001`/`23503`/`restrict_violation`
  na mensagem — usar este helper (não `e.code === "P2003"` sozinho) em
  qualquer `catch` à volta de um `delete()` que dependa de `onDelete:
  Restrict` no schema. Testar sempre um `DELETE` destes contra a BD real
  (curl/browser), não só `tsc`/`vitest` — o bug só aparece em runtime com
  Postgres.
- [2026-08-04] | Ao adicionar a primeira FK real para `Cliente.id`
  (`PedidoPalete.clienteId`), o endpoint já existente `POST
  /api/clientes/agrupar` (que funde variantes de nome e depois faz
  `tx.cliente.deleteMany(...)`) passou a poder rebentar com P2003 se alguma
  variante tivesse pedidos de paletes associados — até então todas as
  ligações a `Cliente` eram por string (`Paragem.cliente`/`Devis.cliente`),
  nunca por FK, por isso o delete nunca tinha este risco. | Sempre que uma
  feature nova acrescenta a PRIMEIRA foreign key real a uma tabela que já
  tinha código a apagar linhas dela livremente, procurar esse código
  existente e repontar as referências (aqui:
  `tx.pedidoPalete.updateMany({clienteId: idsVariantes} -> canonico.id)`)
  antes do delete, dentro da mesma transação. Validado com teste manual
  real: fundir um cliente com pedido associado continuou a funcionar depois
  do fix.

- [2026-07-17] | A 1ª versão da tarifação por paletes (2026-07-14) fazia o
  consumo de combustível continuar a usar `consumoPorCarga(peso, tabela)`
  para paletes, apenas assumindo que o peso sugerido (nº × peso médio)
  calhava sempre no 1º escalão da tabela (0-10000kg = 25 L/100km, igual ao
  vazio). Funcionava por coincidência, não por garantia — e o cliente
  esclareceu depois que o peso nem devia entrar no registo deste tipo de
  carga (só a base/ocupação importa). | Quando um requisito diz "trata X
  como se fosse Y", implementar isso como um branch explícito no código
  (`ehPalete ? 0 : peso`), nunca confiar em que os valores configurados
  hoje calham por acaso no mesmo resultado — isso quebra silenciosamente se
  alguém editar uma tabela/parâmetro no futuro. Também vale a pena
  perguntar explicitamente "este campo ainda é preciso?" quando um
  requisito novo torna um cálculo (peso médio/sugestão automática)
  redundante, em vez de manter código morto "por via das dúvidas".
- [2026-07-14] | Adicionar tarifação por paletes exigiu um novo parâmetro em
  `coeficienteReal(tipoVeiculo, peso, cap)`, mas `tests/calc/perStop.test.ts`
  já a chamava com exatamente 3 argumentos posicionais em 6 sítios — tornar o
  parâmetro obrigatório seria um erro de compilação TypeScript, não só um
  teste a falhar. | Ao estender a assinatura de uma função pura do motor de
  cálculo já testada, acrescentar o novo parâmetro como **opcional com
  default** (`nPaletes = 0`) em vez de obrigatório — mantém todas as chamadas
  antigas válidas e evita ter de tocar em testes que não são sobre a
  funcionalidade nova.
- [2026-07-14] | `ParametrosCusto`/`VeiculoParams` são usados em vários
  objetos-literais "fake" espalhados pelo código para pré-visualizações de
  custo (`VeiculosManager.tsx`, `MotoristaParamsForm.tsx`) e em fixtures de
  teste (`tests/calc/fixtures.ts`) — todos deixam de compilar assim que se
  acrescenta um campo obrigatório ao tipo. | Ao adicionar campos a
  `ParametrosCusto`, correr `tsc --noEmit` cedo (antes dos testes) para
  apanhar todos os literais incompletos de uma vez; não confiar só na busca
  por "quem usa este tipo", os objetos `fake`/dummy para pré-visualização são
  fáceis de esquecer numa pesquisa semântica.

- [2026-07-14] | `vitest` falhava no Windows com `Cannot find module
  '@rollup/rollup-win32-x64-msvc'` (bug conhecido do npm com optionalDependencies
  em plataformas diferentes de onde o lockfile foi gerado — mesma classe do
  problema do esbuild já registado em 2026-06-10, mas para o binário nativo do
  Rollup usado pelo Vite/Vitest). | `npm install @rollup/rollup-win32-x64-msvc
  --no-save` resolve sem tocar em `package.json`/`package-lock.json`. Problema
  de ambiente (Windows), não do código.
- [2026-07-14] | `npx prisma`/`npm run db:push` falhavam com "'prisma' is not
  recognized" neste ambiente Windows (git-bash e PowerShell), porque
  `node_modules/.bin/prisma.cmd` não existia apesar de `node_modules/prisma`
  estar instalado. | Invocar diretamente `node node_modules/prisma/build/index.js
  db push` como alternativa quando o `.bin` falhar.
- [2026-07-14] | Deploy bloqueado na Vercel: "The deployment was blocked
  because the commit author did not have contributing access... Hobby Plan
  does not support collaboration for private repositories." O commit tinha
  `user.email` = conta pessoal do Ricardo (ricardosilva2992@gmail.com /
  GitHub `ricardosilva2992-a11y`), que não é colaboradora do projeto Vercel —
  só `gocris78-cmyk` (dona do repo/projeto) é. | Neste repo, os commits têm de
  ser assinados com `git config user.email "gocris78@gmail.com"` (conta
  `gocris78-cmyk`) para a Vercel aceitar o deploy. Se o autor errado já foi
  empurrado, não é preciso reescrever histórico: basta um novo commit
  (`git commit --allow-empty` chega) com o autor correto e `git push` normal —
  a Vercel builda o commit HEAD mais recente.

- [2026-06-11] | `@react-pdf/renderer` em rota API do Next 14: o webpack do servidor
  tenta empacotar a lib (pesada) e o TS reclama da assinatura de `renderToBuffer`
  (espera `ReactElement<DocumentProps>`) e do `Buffer` vs `BodyInit`. | (1) Adicionar
  `experimental.serverComponentsExternalPackages: ["@react-pdf/renderer"]` ao
  next.config; (2) `export const runtime = "nodejs"` na rota; (3) `createElement(...)
  as unknown as ReactElement<DocumentProps>`; (4) responder com `new Uint8Array(buffer)`
  (não o Buffer cru). Smoke test isolado (`renderToBuffer` → header `%PDF-`) antes de
  confiar no runtime serverless.

- [2026-06-11] | O "Rateio do custo por cliente" (perRoute.ts) atribuía a cada cliente
  `coefReal × custoTotalRota` sem normalizar o coeficiente (peso/capacidade). Como os
  coefs não somam 1, as partes somavam > 100 % (rota 1767 € com coefs 1,09+1,00 →
  3697 € atribuídos), e as margens por cliente não batiam com o lucro da rota. | Num
  rateio, as quotas TÊM de somar 1: `quota = coefReal / Σcoef`,
  `custoAtribuido = quota × custoTotalRota`. Invariantes a testar sempre:
  `Σ custoAtribuido = custoTotalRota` e `Σ margens = lucro`. Manter o coefReal bruto
  só como indicador de sobrecarga. Trajetos a vazio: excluir SÓ por `tipoVeiculo==="VAZIO"`
  (não por `peso>0`), senão perde-se um cliente real faturado com peso 0 mal registado.

- [2026-06-10] | O botão "Sair" (form POST → /api/auth/logout) dava HTTP 405 em /login:
  `NextResponse.redirect()` usa por defeito 307, que **preserva o método POST**, e o
  browser fazia POST a /login (que só aceita GET). | Em redirects após POST (logout,
  submits), usar status **303** (`NextResponse.redirect(url, 303)`) para forçar GET.

- [2026-06-10] | Multi-motorista/multi-veículo: mover salário/veículo dos `Parametros`
  globais para `Utilizador`/`Veiculo` poderia ter quebrado os totais validados
  (HILP01 = 1487,73 €). | Não migrar de forma destrutiva: manter as colunas em
  `Parametros` como defaults/template e congelar um `snapshot` (Json) por paragem no
  registo; o motor (`efetivos` em perStop.ts) usa o snapshot se existir, senão cai no
  contexto atual. Paragens importadas (snapshot null) reproduzem os valores atuais →
  totais preservados ao cêntimo. Os 36 testes existentes passaram sem alteração.
- [2026-06-10] | `kmAnuais` entra TANTO no custo do motorista como no custo fixo do
  veículo (em `derivarCustos`). Ao separar parâmetros por motorista vs veículo surge a
  dúvida de a quem pertence. | Decisão: `kmAnuais` fica no motorista e amortiza também
  os custos fixos do veículo no snapshot (merge {global ⊕ motorista ⊕ veículo}). Modelo
  de km anual único, igual ao Excel. Na pré-visualização de Veículos usa-se um km de
  referência (95 000), rotulado como tal, porque o valor real depende do motorista.

- [2026-06-10] | `vitest`/`vite` falhavam com `Host version "0.21.5" does not match
  binary version "0.28.0"`: o esbuild aninhado do vite (0.21.5) resolvia o binário de
  plataforma `@esbuild/darwin-arm64` hasteado em 0.28.0. | Fix não destrutivo: instalar o
  binário correspondente aninhado —
  `npm install @esbuild/darwin-arm64@0.21.5 --no-save --prefix node_modules/vite/node_modules/esbuild`.
  Não mexer no esbuild de topo (0.28.0). Problema de ambiente, não do código.

- [2026-06-07] | O Excel tinha um bug no "Coef Real" (col P): referenciava a coluna `I`
  (Portagens, um número) em vez do tipo de veículo, pelo que os testes `="VAZIO"`/`="CAMIAO"`
  nunca davam match. | Ao replicar lógica de Excel, validar cada fórmula contra os valores
  calculados e não assumir que a fórmula está correta — confirmar a intenção com o utilizador
  antes de copiar bugs.
- [2026-06-07] | O fator "×14" no custo do motorista parecia arbitrário. | São os 14 salários
  anuais em Portugal (12 + subsídio de Natal + subsídio de férias). Manter editável como
  `fator_anualizacao` e documentar.
- [2026-06-07] | Na importação, `XLSX.read(..., {cellDates:true})` converteu a coluna "Peso
  Transportado" (28000) numa Data, porque a célula tinha formato de data no Excel. Resultou
  em peso 0 e custos 0 na rota HILP01. | Não usar `cellDates` global ao importar folhas com
  formatos mistos; ler números crus e converter datas à mão só para colunas de data
  plausíveis (série > 40000).
- [2026-06-07] | Diferenças de custo de ~1-2 € por rota na importação. | A coluna S "Preço ref
  combustível" varia por linha no Excel (1,83 vs 1,834). Importar como
  `precoCombRefOverride` por paragem (não assumir o preço global para tudo).
- [2026-06-07] | Algumas rotas do Excel tinham "Km feitos" (col G) preenchido mas KM IN/FIM
  vazios. | No importador, usar a coluna "Km feitos" como fallback quando KM IN/FIM estão
  ausentes (kmInicial=0, kmFinal=kmFeitos).
- [2026-06-07] | O campo "Noites" guardava euros mas estava rotulado como contagem (latente).
  Ao introduzir `valorNoite` (custo = nºnoites × valorNoite), os dados antigos (euros)
  ficariam errados. | Antes de mudar a semântica de um campo, inspecionar os valores reais na
  BD; migrar com `round(euros / valorNoite)` e aplicar a MESMA conversão no importador, para
  o recálculo preservar os totais validados (HILP01 = 1487,73 € manteve-se ao cêntimo).
- [2026-06-07] | Adicionar `codigo @unique` a Utilizador com linhas existentes sem valor faz
  o `prisma db push` falhar. | Limpar/migrar as linhas afetadas antes do push; fazer sempre
  backup da BD (`dev.db.bak-*`) antes de alterações de schema com dados reais.
- [2026-06-07] | A cookie de sessão só guardava o perfil; multi-motorista precisa da
  identidade. | Assinar `perfil:id` por HMAC e manter `getSessao()` a devolver o perfil
  (compatibilidade) + novo `getSessaoInfo()`/`getMotoristaId()`; o middleware Edge faz só
  parsing leve (`split(".")[0].split(":")[0]`), a validação forte fica server-side.
