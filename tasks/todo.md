# TODO — App de Gestão e Rentabilidade de Rotas

Plano completo: `/Users/miguel/.claude/plans/quero-que-construas-uma-piped-sphinx.md`

## ☑️ Planta de carga das Rotas — ordem de carga invertida (2026-09-10)

Pedido do Ricardo (com print): "as primeiras paletes da frente no camião são as
últimas". A planta da rota arrumava a 1.ª paragem encostada à cabine (esquerda,
`y=0`) e a última junto às portas — ao contrário da ordem física de carga
(carrega-se ao contrário da descarga: quem sai primeiro entra por último, à mão
nas portas).

- [x] `lib/calc/cargaRota.ts`: `empacotarEstado` arruma sempre pela ordem
  inversa das paragens (`.reverse()`) — partilhado por `verificarEspacoCarga`,
  `gerarPlantaCargaRota` e `gerarPlantaCargaPorTroco` (senão o aviso e o
  desenho divergem — packing é sensível à ordem, ver lessons 2026-09-10)
- [x] `components/CarregamentoFloorPlan.tsx`: rótulos "◄ Frente (cabine)" /
  "Portas ►" por cima de cada caixa (correto também para as Cargas manuais)
- [x] `app/escritorio/rotas/[idRota]/page.tsx`: nota "Ordem de carga: a última
  paragem encostada à cabine, a primeira junto às portas"
- [x] +1 teste (`cargaRota.test.ts`: última paragem em `y=0`, primeira junto às
  portas). 249 testes verdes, `tsc --noEmit` e `next build` limpos
- [x] Diff `git stash` contra as 30 rotas reais: 26 iguais; 4 mudam o nº do
  aviso vermelho (nenhuma entra/sai do aviso): A22 51→39, maravedis2 16→12,
  A2 8→7 sem espaço (packer encaixa mais nesta ordem), maravedis 1→2.
  `totalPaletes`/dinheiro inalterados
- [x] Commit `f6b463f` + push (Vercel builda automaticamente)
- [ ] Confirmação visual do Ricardo numa rota real

## ☑️ Fix: app Motorista Android — faltava o campo "Peso aproximado recolhido (kg)" (2026-09-09)

Reportado pelo Ricardo: "na app offline, falta o campo dos kg recolhidos". O
porte das 5 funcionalidades de paletes (2026-09-08) copiou `pesoAproximado`
(peso descarregado) mas não `pesoAproximadoCarregado` (peso recolhido) do
`RegistoForm.tsx` do site — em Recolha/Mista não havia onde o motorista
registar o peso do que apanhou.

- [x] `app-motorista-android/src/screens/Registar.tsx`: novo campo
  `pesoAproximadoCarregado` no estado, validação, payload e reset ao
  escolher veículo VAZIO; UI replica o site — "Peso aproximado (kg)"
  escondido em Recolha, "Peso aproximado recolhido (kg)" escondido em Descarga
- [x] `app-motorista-android/src/lib/types.ts`: `pesoAproximadoCarregado` em
  `Paragem` e `NovaParagemPayload`
- [x] `tsc -b` + `vite build` (Android) limpos
- [x] `.apk` novo gerado (`npx cap sync android && ./gradlew assembleRelease`,
  09/09 11:42) — `android/app/build/outputs/apk/release/app-release.apk`
- [ ] Instalar o `.apk` novo no telemóvel do motorista
- [ ] Teste manual do Ricardo (registar uma Recolha/Mista, confirmar que o
  peso recolhido fica gravado)

## ☑️ Fix: paragem MISTA + faturarCliente contava a menos (paletes/peso/consumo) (2026-09-08)

Pedido do Ricardo, ao testar RIC-Percam (paragem mista: descarrega 22 PL/28.365 kg
localmente E recolhe 22 PL/3.000 kg faturados a Tecfil): "levei 22 para cima e
trouxe 22 para baixo" mas a rota só mostrava 22 paletes no total, e o consumo
tratava a paragem como vazia. Ver `tasks/lessons.md` para a causa raiz completa
(2 bugs ligados, ambos por assumir que `faturarCliente` = paragem 100% recolha).

- [x] `lib/calc/perRoute.ts::totalPaletes`: exclusão de `jaContadaNaEntrega`
  passa a ser por LINHA (`sentido`), não pela paragem inteira
- [x] `lib/calc/perRoute.ts::totalPesoAproximado/totalPesoAproximadoCarregado`:
  deixam de ter qualquer exclusão (são 2 totais separados, não há dobra a evitar)
- [x] `pesosEmTransitoGenerico`: uma paragem só entra na "linha" `faturarCliente`
  se o seu próprio descarregado for 0 (senão contamina a linha com peso alheio)
- [x] Teste existente corrigido (`recolha: true` em falta no fixture da T4);
  241 testes verdes, `tsc --noEmit`/`npm run build` limpos
- [x] Verificado contra RIC-Percam diretamente: 44 paletes (era 22), 31.365 kg
  descarregados + 3.000 kg recolhidos (era 3.000/0), consumo Tec-Percam 45
  L/100km (era 25, "vazio")
- [x] Diff `git stash` contra as 31 rotas reais: 8 mudam (RIC-Tec-A23,
  RIC-maravedis2, RIC-armazém, RIC-Tec-A22, RIC-A2, RIC-Percam,
  RIC-Tec-eurored, RIC-A22) — todas a subir (valores escondidos a mais, nunca
  a menos), 23 ficam byte-a-byte iguais
- [x] Commit + push (Vercel builda automaticamente)

### Afinação (mesmo dia, o Ricardo reparou que o consumo de Tec-Percam — 45
L/100km sobre 31.365 kg — ainda não fazia sentido: os 3.000 kg só se recolhem
DEPOIS de chegar, não deviam somar-se ao peso de quem chega)

- [x] `pesosEmTransitoGenerico`: uma paragem com `faturarCliente` válido fica
  de fora do mecanismo 2 (grupo normal) SEMPRE, com ou sem linha formada — e o
  destino correspondente também, mesmo que a linha não se tenha formado (todas
  as origens desqualificadas). Cada uma cai isolada no próprio
  `pesoAproximadoTransportado` — nunca misturada com o peso de outra paragem
- [x] +2 testes novos (`pesosAproximadosEmTransito` isolado + `calcularRota`
  end-to-end com os números reais de RIC-Percam). 243 testes verdes
- [x] Verificado contra RIC-Percam: Tec-Percam 45 L/100km sobre os seus
  próprios 28.365 kg (não 31.365), Tecfil 25 L/100km sobre os seus 3.000 kg
- [x] Diff `git stash` contra as 31 rotas reais (desta vez contra o fix
  anterior, já em produção): só 1 muda mais (RIC-Tec-eurored — tinha 2
  paragens antigas com o mesmo padrão, `faturarCliente` mas registadas como
  descarregado, a contaminar o mesmo segmento numa escala menor); os totais
  (totalPaletes/totalPesoAproximado/Carregado) ficam iguais em todas — só o
  consumo/custo por paragem refina
- [x] Commit + push (Vercel builda automaticamente)

## 🔲 Peso aproximado carregado (recolhas) + peso em trânsito para paletes (2026-09-08)

Plano: `C:\Users\Ricardo\.claude\plans\sparkling-toasting-ullman.md`. Pedido do
Ricardo: guardar o peso das recolhas à parte do descarregado, para o sistema
saber o que vai realmente no carro ao longo da rota e derivar o consumo disso
— não de um palpite fixo por paragem. Espelha `pesosEmTransito` (peso em
trânsito do modo kg, já existente) para o modo de paletes.

- [x] `prisma/schema.prisma`: `Paragem.pesoAproximadoCarregado Float?` novo
  (`pesoAproximado` passa a significar sempre "descarregado")
- [x] `lib/calc/perStop.ts`: helpers `pesoAproximadoDescarregado`/
  `pesoAproximadoCarregadoEfetivo`/`pesoAproximadoTransportado` (fallback para
  paragens antigas de RECOLHA pura — mesma regra de sentido de
  `linhasCargaParagem`); `calcularParagem` usa-os no ramo `ehPalete`
- [x] `lib/calc/perRoute.ts`: `pesosEmTransito` refeito sobre um núcleo
  genérico (`pesosEmTransitoGenerico`); novo `pesosAproximadosEmTransito`
  (mesmo algoritmo — segmentos VAZIO + linhas `faturarCliente` — para
  paletes); `totalPesoAproximadoCarregado` novo em `RotaCalc`
- [x] `lib/validacao.ts`, `app/api/paragens/route.ts`, `lib/rotas-service.ts`:
  campo novo propagado (schema, POST, `paragemToInput`); PATCH sem alteração
  (spread genérico já propaga)
- [x] `RegistoForm.tsx` + `ParagemEditor.tsx`: campo único "Peso aproximado"
  passa a depender de `tipoParagem` (DESCARGA/RECOLHA/MISTA), MISTA mostra os
  dois lado a lado; `ParagemEditor` pré-preenche via os helpers de fallback
  (auto-migra uma paragem antiga ao ser reeditada e guardada)
- [x] `app/escritorio/rotas/[idRota]/page.tsx` + `app/motorista/historico/page.tsx`:
  sítios de leitura atualizados (coluna "Peso/Paletes", cartão "Peso aproximado")
- [x] +18 testes novos (`perStop.test.ts`: fallback legado; `perRoute.test.ts`:
  `pesosAproximadosEmTransito` espelhando `pesosEmTransito`, +teste end-to-end
  via `calcularRota` com recolha progressiva). 241 testes verdes, `tsc --noEmit`
  e `npm run build` limpos
- [x] `npm run db:push` corrido pelo Ricardo (coluna nova aplicada na BD real, Neon)
- [x] Diff contra a BD real (`carregarRotas({})` via `git stash` + script
  descartável, antes/depois): **9 de 31 rotas mudam** (16 paragens) — todas por
  melhoria genuína de precisão, não regressão:
  - Recolhas antigas (`recolha=true`, valor no campo legado): o consumo deixa
    de aplicar o valor cru da paragem isolada e passa a refletir a posição real
    na rota (ex. RIC-Tec-A23/Tec-justlog: 37→24 L/100km — é a 1ª recolha do dia,
    o camião chega vazio, não com o peso "adivinhado" antigo)
  - Descargas em rotas multi-paragem: sobem para refletir o que ainda vai a
    bordo para entregas seguintes (mesmo princípio já validado no modo kg,
    ex. RIC-Tec-eurored: 25→28, RIC-A22/Tec-A2: 25→35)
  - `totalPesoAproximadoCarregado` passa a existir (RIC-armazém 0→600kg,
    RIC-Percam 0→3000kg) — valor que já lá estava mas contava como
    "descarregado" por engano em paragens antigas de RECOLHA pura
  - As outras 22 rotas ficam byte-a-byte iguais (sem paletes recolhidas/sem
    recolha antiga sem `pesoAproximadoCarregado`)
- [x] Commit + push (Vercel builda automaticamente)
- [ ] Fora de âmbito: porte para a app Android Motorista (`Registar.tsx`)
- [ ] Teste manual do Ricardo: registar uma paragem RECOLHA/MISTA real no
  telemóvel e confirmar que os 2 campos de peso aparecem como esperado

## ☑️ Planta de carga automática nas Rotas (2026-09-08)

Pedido do Ricardo (com um desenho à mão — sequência de clientes na rota +
paletes a descarregar/recolher): "será possível gerar planta de carga das
rotas? tipo isto". Confirmado por pergunta direta: quer 1 planta só (o
momento de maior ocupação), gerada automaticamente a partir das paragens já
registadas — sem ter de recriar pedidos à mão em Cargas (esse módulo continua
separado, manual, para preparar a carga antes de partir).

- [x] `lib/calc/cargaRota.ts`: `gerarPlantaCargaRota(caixas, paragens)` novo —
  reaproveita a mesma simulação de `verificarEspacoCarga` (extraída para
  `estadosDaRota`, independente das caixas) mas devolve a geometria
  (`ResultadoPacking`) do pior momento, não só as contagens. `null` sem caixa
  configurada ou sem nada a bordo nunca
- [x] `app/escritorio/rotas/[idRota]/page.tsx`: novo card "Planta de carga"
  (usa `CarregamentoFloorPlan`, o mesmo componente de Cargas, só de leitura —
  sem `onReordenar`/`onRodarPalete`, não há pedidos aqui para editar)
- [x] +5 testes (`tests/calc/cargaRota.test.ts`: null sem caixa/sem paletes,
  geometria consistente com `verificarEspacoCarga` em vários cenários). 223
  testes verdes, `tsc`/`next build` limpos
- [x] Verificado com script descartável (só leitura) contra as 31 rotas reais:
  29 com paletes a bordo nalgum momento → 29 plantas geradas, **zero
  inconsistências** entre a geometria e as contagens de `verificarEspacoCarga`
- [x] Commit `46b4425` + push (Vercel builda automaticamente)
- [ ] Teste manual do Ricardo no browser (abrir uma rota real com paletes e
  confirmar que a planta aparece e faz sentido)

## ☑️ Planta de carga — arrastar move só 1 palete, não o lote da linha (2026-09-08)

Pedido do Ricardo: "nas cargas, será que não conseguimos mudar uma palete de
cada vez em vez de ser um lote completo?". Causa: o arrasto (shipped
2026-09-07, ver [[planta-carga-drag]]) reordena por `pedidoId` — mas uma
"linha de pedido" (`PedidoPalete.quantidade`) pode agrupar várias paletes
físicas iguais; arrastar 1 quadrado movia as `quantidade` juntas.

- [x] `moverPalete` (`CarregamentoDetalheEditor.tsx`): se a linha arrastada
  tiver `quantidade > 1`, separa-a primeiro numa linha de 1 (reusa
  `POST .../dividir` com `quantidade:1`, mesmo padrão do ↻ de rotação) e só
  essa nova linha se reposiciona; com `quantidade === 1`, comportamento
  inalterado (reordena a linha diretamente)
- [x] `CarregamentoFloorPlan.tsx`: `onReordenar` passa a entregar
  `(pedidoId, alvoPedidoId, posicao)` ao pai em vez de já calcular a nova
  ordem — o cálculo de `reordenarArrastando` só pode correr depois de saber
  se houve separação (o id a mover muda)
- [x] `tsc --noEmit`, `npm test` (218, inalterados — motor de cálculo não
  tocado) e `npm run build` limpos
- [x] Commit `b28b129` + push (Vercel builda automaticamente)
- [ ] Teste manual do Ricardo no browser (arrastar 1 palete de uma linha com
  quantidade > 1 e confirmar que só ela se move, as restantes ficam)

## 🔲 Porte Android Motorista — as 5 funcionalidades em falta + modelo de dados (2026-09-08)

Plano: `C:\Users\Ricardo\.claude\plans\elegant-discovering-tiger.md`. Retomado depois de
ter sido adiado em 04/09. Investigação de código (não só o `todo.md`) mostrou que o gap
era maior: o modelo de paletes do Android ainda era o pré-catálogo
(`tipoVeiculo="PALETE_120X80/100"` + `kgCarregados`/`kgDescarregados`) — ver
`tasks/lessons.md` 2026-09-08.

- [x] Site: `GET /api/motorista/dados-registo` ganha `tiposPalete` (catálogo),
  dimensões de caixa do veículo/reboque (`caixaComprimentoMm/LarguraMm`,
  `caixaReboqueComprimentoMm/LarguraMm`, `fatorOcupacaoPalete`) e `rotasRecentes`
  passa de `string[]` a `{idRota,tipoVeiculo,kmFinal}[]` (aditivo, sem migração)
- [x] Android: `lib/calc/paletePacking.ts` + `lib/calc/cargaRota.ts` copiados
  quase verbatim do site (só o import interno mudou) para `src/lib/calc/` —
  motor de empacotamento 2D real, antes inexistente na app
- [x] Android: `src/lib/types.ts` + `src/lib/validacao.ts` alinhados com o
  modelo do site (`tipoPaleteId`/`nPaletes`/`nMeiasPaletes`/`paletes[]`/
  `faturarCliente`/`pesoAproximado`; `TIPOS_VEICULO` corrigido para
  `CAMIAO`/`CAMIAO+REBOQUE`/`VAZIO`)
- [x] Android: `Registar.tsx` reescrito — seletor Descarga/Recolha/Mista,
  "+ Adicionar palete" (multi-tamanho), meias-paletes sozinhas, simulação de
  espaço real ao longo da rota (era comparação escalar contra capacidade),
  e o dropdown interno "continuar rota recente" corrigido (já pré-enche
  KM Inicial/Tipo Veículo/resumo da rota, sem `router.push` — via
  `carregarResumoRota` reutilizável)
- [x] Android: `ParagemEditorModal.tsx` (corrigir paragem) atualizado ao novo
  modelo — âmbito reduzido de propósito (1 linha de palete + meias, sem
  multi-tamanho/Mista, decisão explícita no plano)
- [x] Android: `Historico.tsx` — linha "· X kg" (nunca preenchida em paragens
  novas pós-porte) trocada por nº de paletes, com fallback a kg nas paragens
  antigas
- [x] `tsc --noEmit`, `npm test` (218, inalterados), `npm run build` (site) e
  `tsc -b && vite build` (Android) limpos; `oxlint` só com 3 avisos
  pré-existentes (mesmo padrão do `RegistoForm.tsx` do site)
- [x] Commit + push do site (`f240367`, já em `main`/Vercel)
- [x] `.apk` novo gerado (`android/app/build/outputs/apk/release/app-release.apk`,
  08/09 17:22, posterior a todas as fontes alteradas)
- [ ] Instalar o `.apk` novo no telemóvel do motorista — **por confirmar com
  o Ricardo**, a app instalada pode ainda estar na versão antiga
- [ ] Teste manual do Ricardo (registo real, correção no histórico) —
  só depois do `.apk` novo instalado

## 🔲 Estatísticas do veículo — kg a dobra em backhaul + paletes em falta (2026-09-08)

Pedido do Ricardo: "os dados sobre as estatísticas em vários campos não me
parece estar certa" na página `/escritorio/veiculos/[id]`. Investigação
(subagente Explore) confirmou 4 bugs em `lib/veiculos-service.ts`, nunca
revisto quando os bugs irmãos foram corrigidos em `lib/calc/perRoute.ts`
(2026-09-04): (1) kg somava a dobra recolhas faturadas a outro cliente com
entrega na mesma rota (mesmo lote contado 2×); (2) não existia métrica de
paletes, só kg — veículos que só fazem rotas por paletes apareciam com
Kg≈0; (3) "Cargas efetuadas" só contava `kgCarregados>0`, ignorando paragens
só de paletes; (4) "Clientes atendidos" contava "Vazio" (cliente automático
das viagens `tipoVeiculo=VAZIO`) como cliente real.

- [x] `lib/veiculos-service.ts`: `indicesJaContadosNaEntrega()` — mesma
  regra de dedução do `faturarCliente` de `perRoute.ts::totalPaletes`, mas
  aplicada por `idRota` (a ligação recolha→entrega só faz sentido dentro da
  mesma rota, ao contrário de `perRoute.ts` que já só vê uma rota de cada vez)
- [x] `nPaletesParagem()` — cobre os 2 estilos (legado `volume`/`tipoPalete`
  e novo `paletes` Json/dimensão própria), reutiliza `linhasPaleteEfetivas`
- [x] `cargasEfetuadas`: `kgCarregados>0 OU nPaletes>0`
- [x] `clientesAtendidos`: exclui `tipoVeiculo==="VAZIO"`
- [x] Novo `paletesAnoAtual` + `serieMensalPaletesAnoAtual`; `VeiculoGrafico.tsx`
  dividido em `VeiculoGraficoKg`/`VeiculoGraficoPaletes`; página do veículo
  ganha KPI "Paletes transportadas (este ano)" + gráfico mensal a par do de kg
- [x] `tsc --noEmit`, `npm test` (218, inalterados — sem cobertura própria,
  como os outros `*-service.ts`) e `npm run build` limpos
- [x] Verificado com script descartável contra a BD real: RIC-maravedis2
  (Tec-Procartão recolhe 10 pal. faturadas a Tecfil, que entrega essas
  mesmas 10 na mesma rota) somava 30 sem dedução → 20 com dedução, igual à
  correção já validada em `perRoute.ts`; veículo 08-SC-33 (1 paragem só por
  paletes, kg=0) passa de 0 para 1 carga efetuada
- [ ] Commit + push (Vercel builda automaticamente)
- [ ] Teste manual do Ricardo na página do veículo em produção

## 🔲 Planta de carga: arrastar paletes + rodar palete individual (2026-09-07)

Plano: `C:\Users\Ricardo\.claude\plans\quizzical-squishing-ocean.md`. Preparar
carga era lento (setas ↑↓ por cliente + dropdown de orientação + ✂ dividir).
Agora arrasta-se o quadrado da palete na planta para o reposicionar na
sequência de carga (o motor de empacotamento reflui as restantes) e há um ↻
por palete que a separa numa linha própria e roda só essa.

- [x] `lib/carregamento-ordem.ts`: `reordenarArrastando` (novo), remover `moverBlocoCliente`
- [x] `tests/calc/carregamentoOrdem.test.ts`: testes do helper novo (218 verdes)
- [x] `lib/validacao.ts` + rota `dividir`: `orientacao?` opcional na linha nova
- [x] `components/CarregamentoFloorPlan.tsx`: arrasto (pointer events, rato+touch) + botão ↻
- [x] `CarregamentoDetalheEditor.tsx`: `reordenarPedidos`/`rodarPalete`, tabela de
      pedidos plana (sequência real 1,2,3…), removidas as setas ↑↓ e o agrupamento por cliente
- [x] `tsc` + `npm test` (218) + `npm run build` verdes
- [ ] Teste manual do Ricardo no browser (arrasto, ↻, tablet, PDF, ⚡ otimizar) — não
      testável por mim sem browser
- [x] Commit `1fcc656` + push

## 🔲 Categorias de veículo (Ligeiro/Pesado) + consumo por veículo + fix data de inspeção (2026-09-04)

Plano completo: `C:\Users\Ricardo\.claude\plans\quizzical-squishing-ocean.md`. Pedido
do Ricardo: ligeiros só precisam de nome/matrícula/data de inspeção/manutenções/custo
(sem capacidades de carga); pesados passam a poder ter uma tabela de consumo
(L/100km por carga) própria, com fallback para a tabela global de Parâmetros.
O formulário único obrigar capacidades > 0 explicava também o bug "a data de
inspeção não fica guardada" (payload todo rejeitado ao zerar campos irrelevantes).

- [x] `prisma/schema.prisma`: `Veiculo.categoria` (LIGEIRO|PESADO, default PESADO)
      + `TabelaConsumo.veiculoId` opcional (`@@unique([veiculoId, cargaKg])`) — `db push`
      feito na BD real (Neon), sem perda de dados (a unique antiga em `cargaKg`
      já garantia que não havia duplicados)
- [x] Motor: `ParagemSnapshot.tabelaConsumo?` congelado via `calcularSnapshot`/
      `snapshot-service.ts` (mesmo padrão de custo/km e capacidades); `perStop.ts`
      usa `eff.tabelaConsumo` em vez de `ctx.tabelaConsumo` — orçamentos herdam de graça
- [x] `lib/veiculo-form.ts` + `VeiculoCamposForm.tsx`: seletor de categoria; Ligeiro
      esconde capacidades/caixa/reboque/consumo; Pesado ganha tabela de consumo editável
- [x] `lib/validacao.ts` + API `veiculos` (POST/PATCH): `categoria` + `consumo[]`
- [x] Excluir `categoria=LIGEIRO` dos seletores de veículo em registo/rotas/orçamentos/
      cargas (não em histórico/avarias/gestão de frota)
- [x] `tsc --noEmit`, `npm run build` e `npm test` (217 testes) verdes; `prisma db push`
      aplicado na BD real
- [ ] Teste manual do Ricardo em produção (ligeiro grava data; pesado com/sem
      tabela própria dá custo certo) — não testado por mim: implica criar/editar
      veículos na BD real, deixei para o Ricardo confirmar em vez de sujar a frota
      com dados de teste
- [x] Commit `db89000` + push — Vercel builda automaticamente

### Acompanhamento (2026-09-05, ao testar em produção)

Ricardo tentou criar um Ligeiro real e apanhou dois problemas que o plano
original não previu:
- [x] `Vida útil (anos) = 0` (campo comum a Ligeiro/Pesado) rejeitava o
      payload inteiro com só "Dados inválidos." — sem dizer qual campo. Fix
      duplo: `formatarErrosVeiculo()` (`lib/veiculo-form.ts`) traduz
      `parsed.error.flatten().fieldErrors` numa frase legível, usado nos dois
      sítios que mostram `erro` (`VeiculosManager.tsx`, `VeiculoDetalheEditor.tsx`)
- [x] "a tabela de depreciação nos ligeiros não faz sentido" — `CAMPOS_CUSTO_COMUM`
      dividido em `CAMPOS_CUSTO_COMUM` (IUC/seguro/reparações/revisão/inspeção,
      sempre visível) + `CAMPOS_DEPRECIACAO` (aquisição/residual/vida útil/juros,
      só Pesado); preview "Custo veículo/km" também escondido para Ligeiro
- [x] Pedido extra: botão "+ Pedido de manutenção" na página do veículo (novo
      `PedidoManutencaoModal.tsx`, reutiliza `POST /api/avarias` já genérico
      motorista/escritório) — lembrete rápido sem passar pelo form do motorista
- [x] `tsc`/`npm test` (217)/`npm run build` verdes; commit `73ea349` + push

## ☑️ "Continuar rota recente" (dropdown no próprio registo) não puxava o KM Inicial (2026-09-04)

Pedido do Ricardo: "quando fazemos continuar rota actual, falta ao sistema
continuar com os km da ultima vez inseridos". Havia DOIS caminhos para
"continuar rota": (1) o link "Continuar rota" em `/motorista/historico`, que já
navegava com `?idRota=&tipoVeiculo=&kmInicial=` e funcionava bem; (2) o select
"Ou continuar uma rota recente" dentro do próprio `RegistoForm`, que só fazia
`setIdRotaAtiva(id)` local — nunca preenchia `kmInicial` nem `tipoVeiculo`, nem
carregava o resumo da rota (noites/alimentação/paletes já registadas).

- [x] `app/motorista/registo/page.tsx`: a query `rotasRecentes` passa a
  selecionar `tipoVeiculo`/`kmFinal` (já vinha ordenada `distinct` por idRota —
  bastava pedir mais campos) + tiebreak `id: "desc"` (mesma ordem do histórico)
- [x] `RegistoForm.tsx`: o select deixa de mexer só no estado local — navega
  (`router.push`) para os mesmos parâmetros de URL do link do histórico,
  reaproveitando a lógica server-side já correta (kmInicial, tipoVeiculo,
  resumo da rota) em vez de duplicá-la a meio
- [x] `key` novo em `<RegistoForm>` (`page.tsx`), a partir de
  `idRota-tipoVeiculo-kmInicial` — sem isto o React reaproveitava a instância
  ao navegar dentro da mesma rota `/motorista/registo` e o `useState` ficava
  preso aos valores antigos (mesmo padrão da lição de 2026-08-06,
  `EditarNomeCliente`)
- [x] 217 testes verdes (inalterados — mudança de UI/navegação, não de motor
  de cálculo), `tsc`/`next build` limpos
- [x] Verificado contra a BD real: a query nova devolve, por rota, o
  `kmFinal`/`tipoVeiculo` da paragem mais recente (ex. RIC-Blo-coop Valpaços →
  366888 km, CAMIAO+REBOQUE)
- [ ] Commit + push (Vercel builda automaticamente)

## 🔲 Investigar: `coefReal` do rateio pode ter o mesmo bug de "conta a dobra" (2026-09-04, EM ABERTO)

Ao corrigir `totalPaletes`/`totalPesoAproximado` (secção abaixo) reparei que
`RateioCliente.coefReal` (`lib/calc/perRoute.ts::calcularRota`, o loop que
soma `coefPorIndice[i]` por `chaveCliente`) **não** tem a mesma exclusão —
soma o coeficiente da paragem de recolha E o da paragem de entrega ao mesmo
cliente, quando são o mesmo lote físico (`faturarCliente` liga as duas). Isto
**não afeta o dinheiro** (o `custoAtribuido` já está correto, via a
segmentação por troço de hoje) — só o indicador `coefReal`/"% sobre a
capacidade" mostrado na UI, que pode aparecer inflacionado nalguns clientes
com backhaul. Não investiguei nem confirmei com dados reais ainda — verificar
antes de mexer (mesmo processo: diff contra as 28 rotas reais).

## ☑️ totalPaletes/totalPesoAproximado contavam a dobra nos backhauls (2026-09-04)

Pedido do Ricardo: "corrige as voltas todas do separador rotas, tenho quase a
certeza que os valores dos kg totais e das paletes não estão corretos".
Investigação com dados reais confirmou: uma recolha faturada a outro cliente
(`faturarCliente`) que TAMBÉM tem uma entrega nessa mesma rota tinha as suas
paletes/peso aproximado somados **duas vezes** no total da rota — uma vez na
paragem de recolha, outra na paragem de entrega do mesmo lote (ex.
RIC-maravedis2: "Tec-Procartão recolhe 10 paletes faturadas a Tecfil" +
"Tecfil entrega 10 paletes" — o mesmo lote, contado como 20).

- [x] `lib/calc/perRoute.ts::calcularRota`: mesma regra de linha de
  `pesosEmTransito` (faturarCliente aponta para um cliente que tem entrega
  nesta rota) — a paragem de recolha deixa de contar no `totalPaletes`/
  `totalPesoAproximado` (já conta na entrega). Sem entrega correspondente
  nesta rota (o único registo do lote) continua a contar, como sempre
- [x] `RotaCalc.totalPesoAproximado` novo (`lib/calc/types.ts`); página da
  rota deixa de somar `pesoAproximado` à parte, usa `rota.totalPesoAproximado`
- [x] +3 testes, 217 verdes, `tsc`/`next build` limpos
- [x] Diff contra as 28 rotas reais: **6 rotas corrigidas** — RIC-A2 (32→28),
  RIC-A22 (77→52), RIC-Francisco Lince Blowtec (69,5→54,5), RIC-maravedis2
  (30→20), RIC-Tec-A22 (30→28), RIC-Tec-eurored (56,5→40); as outras 22 ficam
  iguais (não tinham o padrão recolha+entrega do mesmo lote)
- [x] **Extra (mesmo pedido)**: label "— dos quais, portagens extra" →
  "Portagens extra" (mais simples); "Horas extra (valorizadas)" mostra agora
  a quantidade de horas antes do valor (ex. "9H - 45,00 €")
- [ ] Commit + push (Vercel builda automaticamente)

## ☑️ Ajustes à página da rota — peso/paletes, L/100km, vazio na coluna do rateio (2026-09-04)

Pedido do Ricardo em `/escritorio/rotas/[idRota]`: (1) coluna "Peso" mostrava 0
nas rotas por paletes (não se regista kg) — mostrar o peso aproximado do
motorista + nº de paletes ("PL"); (2) coluna "€/kg" trocada pelo consumo
L/100km da paragem (já calculado, só não aparecia); (3) tabela de rateio
ganha coluna "dos quais, vazio" — isola a fatia do custo atribuído que veio
de troços VAZIO (a atribuição manual + a fatia automática 50/50 da
segmentação de hoje).

- [x] `lib/calc/types.ts`: `RateioCliente.custoVazioAtribuido` novo
- [x] `lib/calc/perRoute.ts::calcularRota`: `distribuiParaSegmento` ganha
  flag `comoVazio` — soma em paralelo a `custoVazioPorCliente`; atribuição
  manual do vazio conta 100% como vazio
- [x] `app/escritorio/rotas/[idRota]/page.tsx`: coluna "Peso / Paletes"
  (`pesoTransportado` > 0 ? esse : `pesoAproximado`, + "N PL" se houver
  paletes); coluna "L/100km" (`p.consumoL100`, era "€/kg" `precoPorKg`);
  coluna "dos quais, vazio" na tabela de rateio + texto atualizado
- [x] +2 testes (`custoVazioAtribuido` isolado; interação com
  `rateioManual`). 214 testes verdes, `tsc`/`next build` limpos
- [x] Verificado contra 2 rotas reais (RIC-Plas-Sonae, RIC-Percam): peso
  aproximado/nPaletes/consumoL100 todos plausíveis; vazio de RIC-Plas-Sonae
  (248,57 €) reparte 76,78 €/171,79 € — soma certa
- [x] **Extra (mesmo dia)**: Ricardo notou que as portagens extra
  (`portagensExtra`, registadas por paragem) não tinham linha própria na
  "Decomposição do custo da rota" — só as portagens de tabela apareciam.
  Adicionada linha "— dos quais, portagens extra" logo a seguir a "Custos das
  paragens" (é um subconjunto, não uma parcela nova — daí o "dos quais", para
  não parecer que o total deixa de bater certo). Verificado contra 5 rotas
  reais com valor > 0 (RIC-Tec-coop faial 25 €, RIC-Blo-coop Valpaços 62,90 €,
  etc.)
- [x] Commit + push (Vercel builda automaticamente)

## ☑️ Rateio segmentado por troço Ida/Volta — retoma a variante revertida em agosto (2026-09-04)

Pedido do Ricardo ("fazemos os dois", depois do porte Android ter sido adiado):
voltar à repartição do preço por troço, agora que a base de ocupação estava
corrigida. Reimplementa a variante que já tinha sido construída e deployada
em agosto (`64be64d`) e revertida por causa do bloqueio das paletes de
tamanhos diferentes (`82be237`) — ver `tasks/lessons.md` 2026-08-30. **Não**
é o modelo "por troço" completo (esse ficou arquivado, decisão do cliente) —
é a variante mais leve: em vez de UM bolo só (custo × coeficiente/Σcoef de
TODA a rota), cada `tipoViagem`+dia é o seu próprio bolo.

- [x] `lib/calc/perRoute.ts::calcularRota`: nova segmentação por
  `tipoViagem`+dia (mesma chave de `pesosEmTransito`) — dentro de cada
  segmento, custo repartido proporcionalmente ao coeficiente, como sempre.
  VAZIO entre 2 segmentos diferentes: 50/50 por defeito (proporcional dentro
  de cada lado), `rateioManual` (já existia, só para VAZIO) continua a
  funcionar por cima — o que sobrar do manual é que vai 50/50, não dilui na
  rota toda. VAZIO interno ao mesmo segmento: dilui só nesse segmento (como
  sempre). Custos comuns (noites/alimentação/horas extra/portagem tabela):
  continuam proporcionais à rota TODA (não fazem parte da segmentação)
- [x] Rota de 1 segmento só (sem Ida/Volta a sério — a esmagadora maioria das
  rotas) dá **exatamente o mesmo resultado de sempre** — testado
- [x] +5 testes novos em `tests/calc/perRoute.test.ts` (Σcusto conservado,
  troço da Volta não subsidia o da Ida, vazio 50/50, regressão 1-segmento,
  interação com `rateioManual`). 213 testes verdes, `tsc`/`next build` limpos
- [x] Diff contra as 28 rotas reais (`git stash` + comparar): **13 rotas
  mudam de rateio, 15 ficam byte-a-byte iguais** (as de 1 segmento só);
  **`custoTotalRota` de CADA rota confirmado idêntico** antes/depois (só a
  repartição muda, nunca o total faturável). RIC-Percam: 794,73→958,05 €
  Tec-Percam (mesma ordem de grandeza da lição de agosto, 162→692 €)
- [x] **Confirmação do Ricardo** (2026-09-04: "vamos avançar, logo se vê se
  isto está bem") — commit + push feitos
- [ ] Acompanhar as próximas rotas reais com Ida/Volta para confirmar que os
  valores fazem sentido na prática; reverter (`git revert`) se não

## ☑️ Aviso de espaço: recolha na Ida entregue só na Volta (2026-09-04)

Pedido do Ricardo: rota de 2 dias — Ida entrega a 8 clientes e recolhe mais 2
(paletes que ficam a bordo), Volta recolhe mais paletes pelo caminho e entrega
tudo no fim. Perguntou se um "separador Volta" podia marcar início de nova
rota para depois dividir o preço pelos clientes. Investigação (2 testes
empíricos, scripts descartáveis, sem alterar nada): (1) o rateio por troço
Ida/Volta já tinha sido feito e revertido em agosto (ver
`tasks/lessons.md` 2026-08-30) — o bloqueio (paletes de tamanhos diferentes)
já está resolvido; testado com dados reais (RIC-Percam, RIC-Plas-Sonae, etc.)
e confere com a lição antiga; (2) o pedido real era sobre o **aviso de
sobreocupação**, não o preço — encontrado bug real: uma recolha entregue mais
tarde na mesma rota (sem VAZIO a separar) contava a dobra (30 em vez de 16
paletes no cenário testado). Um separador Volta sozinho não resolvia (testado).

- [x] `lib/calc/cargaRota.ts::ParagemCarga` ganha `cliente?`/`faturarCliente?`
  opcionais (retrocompatível — sem eles, zero mudança de comportamento)
- [x] `verificarEspacoCarga`: recolha com `faturarCliente` para um cliente que
  também tem entrega nesta rota fica a bordo desde a recolha até essa entrega,
  atravessando VAZIOs/Ida-Volta — mesma ideia de `pesosEmTransito`
  (`lib/calc/perRoute.ts`), agora aplicada à ocupação de paletes
- [x] Call sites a passar `cliente`/`faturarCliente`: `rotas/[idRota]/page.tsx`,
  `motorista/registo/page.tsx` (+ `select` da query) → `RegistoForm.tsx`
  (`ParagemRotaResumo.faturarCliente` novo)
- [x] +4 testes em `tests/calc/cargaRota.test.ts` (cenário real: pico 16, não
  30; sem faturarCliente = comportamento antigo; VAZIO no meio; 2 entregas
  para o mesmo alvo). 208 testes verdes, `tsc`/`next build` limpos
- [x] Diff contra as 28 rotas reais (`git stash` do fix + correr + comparar):
  **zero diferenças** — as rotas reais com backhaul são todas por peso, nunca
  passavam pelo código alterado; confirma que é seguro publicar
- [ ] Commit + push (Vercel builda automaticamente)
- [ ] Próximo passo, só depois disto assentar: voltar à repartição do preço
  por troço Ida/Volta (o coeficiente de cada cliente passa a estar correto)

## ☑️ Paragem "Descarga / Recolha / Descarga + Recolha" (2026-09-02)

Pedido do Ricardo: além do checkbox "Recolha", poder registar uma paragem em
que descarrega umas paletes E carrega outras — com visibilidade de quantas
foram descarregadas vs recolhidas vs mistas, para melhor avaliar o preço.

- [x] `lib/calc/types.ts`: `PaleteLinha.sentido?: "ENTREGA"|"RECOLHA"` (dentro
  de `Paragem.paletes`, já `Json?` — sem `db push`)
- [x] `lib/validacao.ts`: `sentido` opcional no item de `paletes`
- [x] `lib/rotas-service.ts`: `resolverPaleteDimensoesMuitas` propaga `sentido`
- [x] `lib/calc/cargaRota.ts`: `linhasCargaParagem` devolve
  `{entregues, recolhidas}` (separadas por sentido, fallback pelo `recolha` da
  paragem); `ParagemCarga`/`verificarEspacoCarga` simulam entregas a saírem e
  recolhas a entrarem, mesmo numa paragem mista (estado antes/depois do sítio)
- [x] `perStop.ts`/`perRoute.ts`: sem alteração — já somavam todas as linhas de
  `paletes` independentemente do sentido (coeficiente = paga pelo total)
- [x] UI: seletor "Descarga / Recolha / Descarga + Recolha" (substitui o
  checkbox único) em `RegistoForm.tsx` (motorista) e `ParagemEditor.tsx`
  (escritório); em Mista, dois blocos "Paletes descarregadas"/"Paletes
  carregadas", cada um com "+ Adicionar palete" (tamanhos diferentes)
- [x] 6 testes novos (`cargaRota.test.ts` reescrito p/ nova assinatura +
  `perStop.test.ts`), 204 testes verdes, `tsc`/`next build` limpos
- [x] Verificado: 0 rotas com aviso em `carregarRotas({})` (28 rotas reais,
  inalteradas — `sentido` é opt-in); pipeline completo (validação → resolução
  de dimensões → `linhasCargaParagem` → `verificarEspacoCarga`) testado à mão
  com um payload Mista real (6 descarregadas + 4 carregadas → pico 6, cabe)
- [x] Commit + push (Vercel builda automaticamente). **Sem `db push`**
- [ ] **Ação do Ricardo**: porte do `RegistoForm` para a app Android
  Motorista (bundle próprio) + `.apk` novo — junta-se às alterações
  anteriores (paletes multi-tamanho, meia palete só, aviso de espaço) ainda
  por portar

## ☑️ Meia palete sozinha (sem base por baixo) (2026-09-02)

Plano: `C:\Users\Ricardo\.claude\plans\imperative-weaving-sunbeam.md`. O Ricardo
não conseguia registar uma paragem cuja carga é só meia palete (`nPaletes > 0`
era obrigatório). Decisões: (1) meia solta ocupa chão, 2 meias = 1 lugar;
(2) tirar a regra "meias ≤ paletes de base".

- [x] `lib/validacao.ts`: `paragemSchema` aceita paletes **OU** meias (tipoPalete
  continua obrigatório). `RegistoForm.validar` + `ParagemEditor.guardar` idem
- [x] `RegistoForm`: removido o aviso "meias > bases"; rótulos ("Nº de paletes
  inteiras" / "sozinhas no chão")
- [x] `lib/calc/cargaRota.ts::linhasCargaParagem`: `nMeiasPaletes?` novo —
  `meiasNoChao = max(0, meias − Σ bases)`, `slots = ceil(meiasNoChao/2)`, linha
  extra da mesma dimensão. Reverte parcialmente a decisão de 2026-08-28 (meias
  "nunca ocupam espaço") — ver `tasks/lessons.md`
- [x] Motor de rateio **intocado** (`linhasPaleteEfetivas`/`coefPaletesDimensao`
  já tratavam `nPaletes:0 + meias>0`; teste já existia: 6 meias → 3/38)
- [x] `registo/page.tsx` (+`nMeiasPaletes` no select). +5 testes (199 verdes),
  tsc/build limpos
- [x] Verificado contra produção: 2 paragens reais com meias.
  **RIC-Plas-Sonae / Plas-Sonae tem `nMeiasPaletes = 50`** (+1 palete inteira) →
  com a regra nova conta como 25 lugares de chão e a rota volta a mostrar o aviso
  de espaço. **A confirmar com o Ricardo se os 50 estão certos.**
- [ ] Commit + push
- [ ] Porte Android Motorista

## ☑️ Aviso de espaço: simular a ocupação ao longo da rota (2026-09-02)

Plano: `C:\Users\Ricardo\.claude\plans\imperative-weaving-sunbeam.md`. O aviso de
sobreocupação somava TODAS as paletes da rota ("pior caso") — falso quando o
motorista entrega umas e recolhe outras pelo caminho (o camião nunca teve tudo
ao mesmo tempo). Ex. real: RIC-Plas-Sonae "cabem 35 de 54". O Ricardo passa a
marcar "Recolha" nas recolhas.

- [x] `lib/calc/cargaRota.ts`: `verificarEspacoCarga(caixas, ParagemCarga[])` —
  ordena por km, corta em segmentos nos VAZIO, e por segmento simula os estados
  a bordo (entregas a bordo desde o início→saem na sua paragem; recolhas
  entram→ficam até ao fim) arrumando cada estado com o motor 2D; devolve o pior.
  `totalPaletes` passa a ser "paletes a bordo no pior momento"
- [x] `rotas/[idRota]/page.tsx` (novo formato + texto do banner), `RegistoForm`
  (`ParagemRotaResumo` +recolha/tipoVeiculo/kmInicial, `espacoCargaRota`),
  `registo/page.tsx` (select + map)
- [x] `tests/calc/cargaRota.test.ts` reescrito (12 casos: entrega-depois-recolha,
  pico misto, VAZIO corta, só recolhas, tamanhos diferentes). 195 verdes,
  tsc/build limpos
- [x] Comparação em TODAS as rotas reais: 3 avisos falsos limpos (greenopinion
  44→22, Carvidet 48→37, Plas-Sonae 54→34), 1 overflow real mantém-se
  (Francisco Lince Blowtec 34, sem recolha/vazio). Nenhuma rota que transborda
  a sério perdeu o aviso
- [ ] Commit + push
- [ ] Follow-up possível: modo "Entrega e recolha" numa paragem (3 estados +
  nº descarregado/carregado), se registar 2 linhas p/ mistas incomodar
- [ ] Porte Android Motorista (RegistoForm) + `.apk`

## ☑️ Paletes de tamanhos diferentes na mesma paragem (2026-09-01)

Plano: `C:\Users\Ricardo\.claude\plans\imperative-weaving-sunbeam.md`. Pedido do
Ricardo: o mesmo cliente, na mesma descarga, com paletes de tamanhos diferentes
— botão "+ Adicionar palete" ao lado de "Recolha" no registo. Era a limitação
que fez reverter o rateio Ida/Volta.

- [x] Schema: `Paragem.paletes Json?` — `[{ tipoPaleteId, comprimentoMm,
  larguraMm, nPaletes }]`, dimensões congeladas no registo. `null` = linha única
  (todo o histórico, zero migração). Aditivo. **`db push` pendente — bloqueado
  pelo classificador, o Ricardo corre `npm run db:push`**
- [x] `lib/calc/types.ts` (`PaleteLinha`, `ParagemInput.paletes`, passthrough em
  `ParagemCalc`); `perStop.ts` (`linhasPaleteEfetivas()` + `coefPaletesDimensao()`
  — coeficiente = Σ nPaletesᵢ/capacidade(dimᵢ); meias usam a cap. da 1.ª linha;
  1 linha == campos escalares, provado por teste); `perRoute.ts` (`totalPaletes`
  + `coeficienteReal` por linhas); `cargaRota.ts` (`linhasCargaParagem()`)
- [x] `lib/validacao.ts` (`paragemSchema.paletes` + superRefine); `rotas-service.ts`
  (`resolverPaleteDimensoesMuitas` + passthrough); `POST`/`PATCH /api/paragens`
  (resolve dims por linha, grava `paletes` + escalares agregados; PATCH aceita
  `[]` p/ voltar a linha única)
- [x] UI: `RegistoForm.tsx` + `ParagemEditor.tsx` (modo paletes) — 1.ª linha nos
  campos de sempre, botão "+ Adicionar palete" + linhas extra com "✕ remover";
  avisos de sobreocupação iteram as linhas. `registo/page.tsx` +
  `rotas/[idRota]/page.tsx` + `historico/page.tsx` passam `paletes`
- [x] Só envia `paletes` quando há > 1 linha — 1 linha = payload de sempre, zero
  mudança de comportamento
- [x] +9 testes (perStop/perRoute/cargaRota), 191 verdes, `tsc`/`next build` limpos
- [ ] **Pendente (Ricardo)**: `npm run db:push`; depois E2E contra produção +
  `git push`; porte manual p/ app Android Motorista + `.apk` novo
- [ ] Orçamentos ficam com 1 linha de palete (fora de âmbito, decisão do Ricardo)

## ✅ DECIDIDO — modelo de rateio: MANTER o atual "por paletes / espaço" (2026-08-30)

O cliente decidiu **manter o modelo atual**: faturação por paletes/espaço
ocupado (`coeficienteReal / Σcoef × custoTotal`), km a vazio diluídos por todos
os clientes por defeito, com a atribuição manual de km do vazio disponível para
ajustar caso a caso (`rateioManual`, já existe). O modelo "por troço" fica
**arquivado** — não implementar.

> **Nota (2026-09-01):** o rateio separado por Ida/Volta chegou a ser
> implementado e deployado (`64be64d`) e a segmentar por VAZIO o aviso de
> sobreocupação (`841c4c0`), mas o Ricardo pediu para **reverter os dois** (a
> base — coef por paragem — não aguenta paletes de tamanhos diferentes no mesmo
> cliente, questão a resolver primeiro). Revert em `82be237`. O aviso de
> sobreocupação volta a somar as paletes de toda a rota (sem cortar no VAZIO).

Consequência aceite: numa rota com uma viagem à parte (ida + vazio + recolha), a
carga maior paga sempre uma fatia proporcional do custo total, mesmo dos troços
que não fez (ex. RIC-Blo-greenopinion: casimper 22 pal = 50 %). A atribuição
manual do vazio não corrige isto (o vazio é só parte da fatia). Se algum dia o
cliente mudar de ideias, ver a análise abaixo — a alternativa seria "por paletes
MAS por segmento" (ida/volta ratreadas à parte).

--- análise arquivada (para não se re-derivar se voltar à conversa) ---

**Problema encontrado** (rota real RIC-Plas-Sonae): o rateio atual reparte
**todo** o custo não-manual por peso/capacidade (`coeficienteReal / Σcoef`),
ignorando de quem era cada troço. Numa rota onde uma carga pequena obriga a uma
viagem longa, isto subcobra quem deu a volta grande.

Números da RIC-Plas-Sonae (custo total 632,90 €; vazio de 259 km já atribuído à
mão 80 km→Plas-Sonae / 179 km→Tecfil):

| | modelo atual (por peso) | modelo "por troço" |
|---|---|---|
| Plas-Sonae (34 pal, entregas 116 km) | 318,05 € (50 %) | ~233 € |
| Tecfil (20 pal, recolha a 161 km) | 314,84 € (50 %) | ~400 € |

- **Atual**: `custoProporcional = custoTotal − custoManual`; cada cliente paga
  `(coefReal/Σcoef) × custoProporcional` + a sua parte manual do vazio. A
  Plas-Sonae paga 240 € de troços quando os seus só custaram 125 € — está a
  pagar parte da ida buscar o Tecfil.
- **"Por troço"**: cada cliente paga o `custoParagem` dos **seus** troços +
  a sua fatia do(s) vazio(s) + fatia dos custos comuns da rota (horas extra,
  portagens tabela — ~60,65 € nesta rota).

**Se avançar**: mexe em `lib/calc/perRoute.ts` (loop do rateio) e afeta TODOS
os rateios. Revalidar contra rotas reais + os testes (HILP01 = 1487,73 € tem
de se manter; há ~46 testes sobre rateio). Manter a atribuição manual do vazio
a funcionar por cima. Ver também: acrescentar atribuição manual de km a troços
NÃO-vazios (hoje só VAZIO tem `rateioManual`).

**Modelo "por troço" concreto** (Excel do Ricardo, rota-teste RIC-Blo-
greenopinion, 31/08/2026 — 4/5/13 pal entregues 120 km cada + VAZIO 80 km +
casimper 22 pal 100 km; capacidade 22): cada cliente paga
`(nPaletes / capacidade) × kmFeitos-do-seu-troço × €/km`. Vazio à parte (não
atribuído). Total 360 € vs 525,54 € da app.

| | app (por peso) | Excel (por troço) |
|---|---|---|
| greenopinion | 47,78 | 26,18 |
| plastiagro | 59,72 | 32,73 |
| Carvidet | 155,27 | 85,09 |
| casimper | 262,77 | 120,00 |
| vazio | diluído | 96,00 (à parte) |

Sub-decisões: (a) €/km fixo (Excel usa 1,2) vs custo real derivado (~0,97 €/km
sem margem; ×1,25 ≈ 1,22); (b) km — 3 entregas partilham 1 troço vs troço
próprio cada (a app conta 540 km, o Excel 300); (c) o que fazer ao vazio
(empresa come vs diluir vs atribuição manual).

**Refinamento do Ricardo (2026-08-30, conversa a seguir):** a rota parte-se em
**segmentos nos vazios** (mesma segmentação já usada no aviso de espaço).
- Segmento de IDA (várias entregas): cada cliente paga só o seu troço
  (paletes a bordo × km do troço × €/km). O cliente da recolha/volta **NÃO
  entra** no rateio deste segmento — não tem nada a ver com a ida.
- Vazio entre a última entrega e a recolha: **50 % repartido pelos clientes da
  ida** (levaram o camião para lá) + **50 % ao cliente da recolha** (o camião
  reposiciona-se para o ir buscar). O `rateioManual` do vazio já permite isto à
  mão hoje — o 50/50 seria o *default* automático, ajustável.
- Segmento de VOLTA/recolha: esse cliente paga o seu troço + a sua metade do
  vazio. Sem fatia proporcional do custo total da rota.
- O campo `tipoViagem` (Ida/Volta) NÃO é preciso para isto — a segmentação por
  vazio chega. (Ida/Volta continua só para `pesosEmTransito`.)
Ponto explícito do Ricardo: o cliente da recolha não deve ter "o preço total
dividido pelas suas paletes" — só paga o que a recolha custou + vazio.

**Extra pedido de caminho** (independente da decisão acima): coluna "Preço
mínimo" (custo atribuído × 1,25) e decomposição "dos quais, vazio" na tabela do
rateio em `/escritorio/rotas/[idRota]`.

## ☑️ Registo do motorista — aviso de sobreocupação de espaço da rota (2026-08-30)

Plano: `C:\Users\Ricardo\.claude\plans\flickering-discovering-dawn.md`. Pedido do
Ricardo: à medida que o motorista regista paragens, o sistema soma TODAS as
paletes da rota, arruma-as com o motor 2D real e avisa quando não cabem.

- [x] `lib/calc/cargaRota.ts` (novo): `verificarEspacoCarga(caixas, linhas)` —
  reusa `empacotar`/`expandirPedidosEmUnidades`. `dimensoesPaleteParagem` +
  `DIMENSOES_PALETE_LEGADO` (resolve `Paragem.tipoPalete` string legado
  "PALETE_120X80"→1200×800 / "…100"→1200×1000)
- [x] Motorista `RegistoForm.tsx`: aviso por-paragem (fórmula crua
  `paletesQueCabem`) → aviso **cumulativo da rota** (soma paragens já
  registadas + a que está a escrever, motor 2D). `page.tsx`: query
  `paragensRotaAtiva` + `nPaletes`/dims/`tipoPalete`, resolvidas server-side
- [x] `/escritorio/rotas/[idRota]`: banner vermelho no topo quando as paletes
  registadas não cabem no veículo (+reboque) — "cabem X de Y (Z sem espaço)"
- [x] `tests/calc/cargaRota.test.ts` (6). 182 testes verdes, `tsc`/`build` limpos
- [x] E2E contra a BD real: `verificarEspacoCarga` corrido em todas as 12 rotas
  reais com paletes — 10 cabem, 2 assinaladas: RIC-Plas-Sonae (54 pal → 35, é
  multi-viagem sob 1 idRota) e RIC-Francisco Lince Blowtec (34 → 32, carga no
  limite). Banner do escritório confirmado no browser (aparece só quando não
  cabe). Aviso não bloqueia (pior caso — pode avisar a mais)
- [x] Commit + push (`1c81e59`)
- [ ] **Ação do Ricardo**: porte manual do `RegistoForm` para a app Android
  Motorista + `.apk` novo (bundle próprio)

## ☑️ Cargas — dividir linha de pedido (orientações diferentes) (2026-08-30)

Pedido do Ricardo: ter 4 paletes 1300×1100 de um cliente e carregar 2 ao comprido
+ 2 ao través. A orientação é por linha de pedido — faltava poder partir uma linha.

- [x] `POST /api/carregamentos/[id]/pedidos/[pedidoId]/dividir` (`{quantidade}`,
  só ESCRITORIO): separa N paletes para uma linha nova (mesmo cliente/tipo/
  orientação), logo a seguir; renumera a sequência de carga
- [x] `lib/validacao.ts`: `dividirPedidoSchema`
- [x] UI `CarregamentoDetalheEditor.tsx`: botão "✂ dividir" em cada linha com
  quantidade ≥ 2 (qtd 2 → 1+1 direto; qtd > 2 → pergunta quantas). Cada metade
  fica com o seu seletor de orientação
- [x] `tsc`/`vitest` (176)/`next build` limpos (rota nova no output)
- [x] E2E contra a BD real: dividir ped24 (x5) do #9 → x3 + ped27 x2 (mesma
  orientação), ordem renumerada; MOTORISTA → 403; separar 99 → 400. Estado do
  #9 reposto ao original
- [x] Commit + push (`ee54d0f`)

## ☑️ Cargas — empacotamento 2D real (MaxRects + faixas, o melhor dos dois) (2026-08-30)

Plano: `C:\Users\Ricardo\.claude\plans\flickering-discovering-dawn.md`. Bug real
do Ricardo (carreg. #9): 11 paletes 1300×1100 cabem no AO-33-PJ (faixa de 6 "ao
través" + faixa de 5 "ao comprido") mas o motor por prateleiras só metia 10 (não
exprime faixas a ritmos diferentes).

- [x] `lib/calc/paletePacking.ts`: `empacotar` passa a correr 2 algoritmos e a
  ficar com o que coloca mais paletes (empate → faixas):
  `empacotarPorFaixas` (o de prateleiras, renomeado/adaptado a `itens[]`) +
  `empacotarMaxRects` (novo, maximal-rectangles Best-Short-Side-Fit)
- [x] `CaixaResultado.prateleiras` → `CaixaResultado.itens` (lista plana);
  `PrateleiraResultado` e `PaleteColocada.prateleiraIndex` removidos
- [x] `components/CarregamentoFloorPlan.tsx` + `lib/pdf/PlantaCargaDocument.tsx`:
  `cx.prateleiras.flatMap(p=>p.itens)` → `cx.itens`
- [x] `estimarQuantosCabem` max default 500 → 150 (perf: corre 2 algoritmos)
- [x] `tests/calc/paletePacking.test.ts` reescritos (asserções sobre `itens` +
  invariante "sem sobreposições"; novo teste do caso #9: 11 cabem, 12ª não).
  176 verdes; estabilidade append-only mantida; `tsc`/`build` limpos
- [x] E2E: diff antes/depois de TODOS os carregamentos reais (#5–#9) — **nenhum
  regride**; #7 (38× 1200×800) mantém 38 (via faixas, MaxRects sozinho dava 36);
  #9 sobe a 11/11 (via MaxRects). Página e PDF do #9 OK, sem "Sem espaço"
- [x] `tasks/lessons.md` (não assumir que o algoritmo novo domina o antigo)
- [x] Commit + push (`0ef4ae3`)

## ☑️ Cargas — "Ao através" deixa de desperdiçar filas (2026-08-30)

Plano: `C:\Users\Ricardo\.claude\plans\flickering-discovering-dawn.md`. Bug real
encontrado pelo Ricardo no carreg. #9: forçar "Ao través" a 10 paletes 1300×1100
(caixa 7500×2480) metia 1 por fila e deixava 4 de fora, quando 1300+1100 cabe.

- [x] `lib/calc/paletePacking.ts`: `orientacoesQueCabem` deixa de excluir a
  orientação não-preferida (COMPRIDO/TRAVES passam a preferência, não obrigação).
  `tentarColocarNaCaixa`: nova ordenação `porPreferencia` (tenta a orientação da
  linha primeiro); ao abrir prateleira, se a orientação escolhida sozinha não
  mete 2 na fila (`2×largura > caixa`) mas escolhida+rodada cabem, reserva
  `profundidade = max(escolhida, alt)` para a rodada seguinte encostar
- [x] Texto de ajuda na planta: "Ao comprido/Ao través definem a orientação
  principal — o motor pode rodar algumas paletes para as encostar"
- [x] `tests/calc/paletePacking.test.ts`: 3 testes de orientação reescritos
  (TRAVES 10×1300×1100 → 5 filas de través+comprido; COMPRIDO 1100 → pares sem
  rodar; preferida que não cabe na largura → cai para a alternativa). 175 verdes,
  `clienteA`/estabilidade inalterados. `tsc`/`build` limpos
- [x] E2E contra a BD real: carreg. #9 com 24/25 forçados a TRAVES → 10/10 em 5
  filas (2400mm cada), 0 sem espaço; estado do #9 restaurado
- [x] `tasks/lessons.md` (preferência ≠ restrição rígida)
- [x] Commit + push (`1e78f25`)

## ☑️ Cargas — rodar as paletes na planta de carga (2026-08-30)

Plano: `C:\Users\Ricardo\.claude\plans\flickering-discovering-dawn.md`. Última
parte do pedido "tetris": forçar a orientação das paletes quando o Ricardo sabe
melhor do que o automático. Granularidade escolhida: **por linha de pedido**.

- [x] Schema: `PedidoPalete.orientacao String @default("AUTO")` (AUTO / COMPRIDO
  / TRAVES) — aditivo, `db push` no Neon (linhas existentes → "AUTO")
- [x] `lib/calc/paletePacking.ts`: `OrientacaoPalete`; campo opcional
  `orientacao?` em `PaleteUnidade`/`PedidoParaExpandir` (default AUTO, não quebra
  callers); filtro em `orientacoesQueCabem` (COMPRIDO→`rotacionado:false`,
  TRAVES→`rotacionado:true`); passthroughs. `otimizarOrdem`/`estimar` intocados
- [x] `lib/carregamento-service.ts`: `orientacao` nos 2 maps de pedidos + no tipo
  `CarregamentoDetalhe.pedidos`
- [x] `lib/validacao.ts`: `ORIENTACOES_PALETE`; `pedidoPaleteUpdateSchema` passa a
  ter `quantidade`+`orientacao` opcionais com `.refine` (pelo menos 1)
- [x] `PATCH /api/carregamentos/[id]/pedidos/[pedidoId]`: grava os campos
  presentes (só ESCRITORIO, já herdado)
- [x] UI: `CarregamentoDetalheEditor.tsx` — coluna "Orientação" (select
  Automática/Ao comprido/Ao través) por linha; `CarregamentoFloorPlan.tsx` ganha
  prop opcional `onRodarPedido` — clicar numa palete roda a linha inteira
  (alterna COMPRIDO↔TRAVES a partir do que está desenhado). PDF sem alteração
  (usa o `packing` já resolvido)
- [x] +4 testes (`paletePacking.test.ts`: TRAVES/COMPRIDO forçam, forçada que não
  cabe → NAO_CABE_ORIENTACAO, `expandir` propaga). 175 verdes, `tsc`/`build` OK
- [x] E2E contra a BD real (`next start`, sessão HMAC): `PATCH` pedido 20 →
  TRAVES → 4 paletes `rotacionado:true`, planta muda; `{}` → 400; MOTORISTA →
  403. Dados de produção repostos a AUTO
- [x] Commit + push (`13e40ea`, Vercel builda automaticamente)

## ☑️ Cargas — otimizar disposição das paletes + reordenar clientes (2026-08-30)

Plano: `C:\Users\Ricardo\.claude\plans\flickering-discovering-dawn.md`. Pedido do
Ricardo: rodar as paletes no esquema para ver o melhor aproveitamento ("tetris")
e poder mudar a ordem dos clientes. O motor `paletePacking` já testava rotação;
faltava reordenar (por design nunca reordena — empacotamento "online").

- [x] `lib/calc/paletePacking.ts`: `otimizarOrdem(caixas, pedidos)` +
  `pontuarPacking` — mantém cada cliente num bloco contíguo, linhas do bloco por
  área desc (FFD), permuta a ordem dos blocos (≤6 clientes: força bruta ≤720;
  >6: 4 heurísticas). Score lexicográfico: cabe tudo > menos caixas > carga mais
  curta; empate mantém a ordem atual (para detetar `jaOtima`)
- [x] `lib/carregamento-ordem.ts` (novo): `moverBlocoCliente` (puro, testável) —
  move o bloco de um cliente ↑/↓ mantendo as suas paletes juntas
- [x] `lib/carregamento-service.ts`: `construirCaixas()` extraído (reutilizado);
  `simularOrdemOtimizada(id)` → `{ jaOtima, ordemSugerida, pedidoIdsOrdenados,
  ganho }`
- [x] `POST /api/carregamentos/[id]/otimizar` (`{aplicar?}`: simula, ou reescreve
  `PedidoPalete.ordem` numa `$transaction`); `PATCH .../pedidos/ordem`
  (`{ordemPedidoIds}`, valida permutação exata) — ambas só ESCRITORIO
- [x] `CarregamentoDetalheEditor.tsx`: tabela de Pedidos agrupada por cliente com
  setas ↑/↓; botão "⚡ Otimizar disposição" + painel (ordem sugerida, frases de
  ganho, "Aplicar"/"Ignorar"); painel limpa-se em qualquer outra mutação
- [x] `tests/calc/paletePacking.test.ts` (+4: `otimizarOrdem`) +
  `tests/calc/carregamentoOrdem.test.ts` (novo, 6). 171 testes verdes,
  `tsc`/`next build` limpos (2 rotas novas no output)
- [x] E2E contra a BD de produção (`next start`, sessão HMAC forjada):
  carregamento real #8 (3 clientes) — simular propõe 22→21→20 (14,3 m em vez de
  14,7 m); MOTORISTA→403; permutação inválida→400; #999→404; #6 (1 cliente)→
  `jaOtima`; aplicar reescreve a ordem, reorder manual repõe 20/21/22. Dados de
  produção repostos ao estado original
- [x] Commit + push (`ec548ba`, Vercel builda automaticamente)

## ☑️ Revisão de segurança + upgrade Next.js 14→16 (2026-08-29/30)

Pedido do Ricardo: rever o código quanto a falhas de segurança. Encontrado por
`npm audit`: cookie de sessão sem `Secure`, `xlsx` com 2 CVEs altas (sem fix no
npm), Next.js 14.2.35 com 21 CVEs (só corrigidas na 16.3.3, breaking change).

- [x] Cookie de sessão ganha `secure: NODE_ENV==="production"` (`52ecf6a`)
- [x] `xlsx` trocado para o build oficial do CDN da SheetJS, 0.20.3 (`eb73407`)
  — testado exportar+reimportar, sem alterações de código necessárias
- [x] Tag `pre-next16-upgrade` no GitHub, ponto de retorno antes do upgrade
- [x] Next.js 14.2.35 → 16.3.3, React 18→19 (`60c5a18`) — feito com
  `@next/codemod` oficial: `cookies()`/`headers()` assíncronos
  (`lib/session.ts` + ~60 call-sites), `params` assíncrono em todas as
  páginas/rotas `[id]`, `middleware.ts` → `proxy.ts` (lógica
  bit-a-bit igual, só o nome mudou), `next.config.mjs`
  (`serverExternalPackages`)
- [x] `npm audit --omit=dev`: 0 vulnerabilidades (antes: 2 altas + as 21 do
  Next.js). 161 testes inalterados, `tsc`/build limpos
- [x] Testado localmente (BD real): login, dashboard, rota, CORS, PDF — tudo OK
- [x] Bug real encontrado ao testar (não do upgrade em si): botão "Entrar"
  ficava clicável antes da navegação terminar → 2º clique disparava 2º
  carregamento do dashboard em simultâneo → esgotava o connection pool
  (P2024). Corrigido em `app/login/page.tsx` (`bc7567d`)
- [x] Commit + push de tudo

## ☑️ Imprimir a planta de carga (2026-08-28)

Pedido do Ricardo: no módulo Cargas, poder imprimir a planta de carga para
dar ao motorista e a quem carrega o camião. Seguido o padrão já existente no
projeto (PDF gerado no servidor com `@react-pdf/renderer`, não
`window.print()` — não havia nenhum uso disso no código).

- [x] `lib/pdf/PlantaCargaDocument.tsx` (novo): mesma leitura visual do ecrã
  (`components/CarregamentoFloorPlan.tsx`) — 1 caixa (Svg) por veículo/
  reboque, mesma paleta de cores por cliente, legenda, aviso se houver
  paletes não colocadas, tabela-resumo cliente/tipo/quantidade. A4 paisagem.
- [x] `app/api/carregamentos/[id]/planta-pdf/route.ts` (novo): `runtime =
  "nodejs"`, só escritório, reaproveita `carregarCarregamento()` já
  existente (zero lógica de cálculo nova)
- [x] `CarregamentoDetalheEditor.tsx`: botão "Imprimir planta de carga"
  (`DescarregarPdfBotao`, componente já existente) junto ao cabeçalho da
  secção
- [x] `tsc`/`vitest` (161, inalterados)/`next build` limpos
- [x] Verificado com 3 carregamentos reais (até 30 paletes, 2 caixas —
  camião+reboque, 3 clientes): PDF gerado e inspecionado visualmente,
  cores/posições/legenda/tabela corretas, quebra de página automática entre
  caixas
- [x] Commit + push (`50ccd28`)

## ☑️ Cartões da rota: paletes em vez de kg (2026-08-28)

Pedido do Ricardo: na página da rota (`/escritorio/rotas/[idRota]`), o foco
passa a ser a quantidade de paletes transportadas, não os kg.

- [x] `app/escritorio/rotas/[idRota]/page.tsx`: os cartões "Total KG
  Carregados/Descarregados" passam a "Paletes transportadas" + "Peso
  aproximado" (soma de `pesoAproximado`, o campo que o motorista introduz)
  sempre que a rota tem paletes (`rota.totalPaletes > 0`); rotas antigas por
  peso (`totalPaletes = 0`) mantêm os 2 cartões de kg como sempre — mostrar
  paletes OU kg, nunca 0 à toa numa rota real
- [x] `tsc`/`vitest` (161, inalterados)/`next build` limpos; confirmado com
  2 rotas reais (RIC-Blowtec: paletes=9, peso aprox. ainda não preenchido →
  "—"; RIC-Percam: kg como sempre)
- [x] Commit + push (`41c931c`)

## ☑️ Atribuição manual do custo de troços VAZIO por km (2026-08-28)

Plano: `C:\Users\Ricardo\.claude\plans\steady-wondering-whisper.md`. O custo de
um troço VAZIO era sempre diluído automaticamente pelos clientes da rota
(proporcional a peso/paletes) — pedido do Ricardo: poder substituir isso,
atribuindo manualmente km desse troço a um ou mais clientes.

- [x] Schema: `Paragem.rateioManual` (Json?, `{cliente,km}[]`) — `db push` no Neon
- [x] `lib/calc/types.ts`: `RateioManualItem`, passthrough em `ParagemInput`/`ParagemCalc`
- [x] `lib/calc/perRoute.ts::calcularRota`: km atribuídos -> fração do troço
  (`km/kmFeitos`, escalada se somar mais do que o troço fez) -> valor fixo
  por cliente, fora do pool proporcional (`custoTotalRota - custoManualTotal`);
  quota recalculada no fim a partir do `custoAtribuido` real — Σcusto e
  Σquota continuam a verificar sempre, com ou sem override
- [x] `lib/validacao.ts`, `app/api/paragens/route.ts` + `[id]/route.ts`
  (`rateioManual` só grava em troços VAZIO, só escritório — junta-se a
  `CAMPOS_ESCRITORIO`), `lib/rotas-service.ts` (passthrough)
- [x] UI: `ParagemEditor.tsx` ganha secção "Atribuir km deste troço vazio a
  clientes" (só quando `tipoVeiculo=VAZIO`, uma linha por cliente da rota,
  total ao vivo); `ParagemAcoes.tsx`/`rotas/[idRota]/page.tsx` passam
  `clientesRota` (de `rota.rateio`)
- [x] 5 testes novos (`tests/calc/perRoute.test.ts`) — split total, parcial,
  a somar mais km do que o troço (escala), cliente novo só via manual,
  baseline sem override; 161 testes verdes, `tsc`/`build` limpos
- [x] Verificado contra a rota real `RIC-Blowtec` (vazio de 69 km): atribuir
  100% a um cliente moveu 138,28€→149,06€ / 31,61€→20,82€, custoTotalRota
  manteve-se em 169,88€ ao cêntimo; revertido de seguida (dados de produção
  sem alteração)
- [x] Commit + push (`330e14c`)

## ☑️ Campos opcionais por motorista (2026-08-28)

Plano: `C:\Users\Ricardo\.claude\plans\steady-wondering-whisper.md`. Alguns motoristas
nunca fazem noites fora — os campos "Noites fora"/"Alimentação"/"Horas extra"
passam a ser desligáveis por motorista, na página de edição já existente.

- [x] Schema: `Utilizador.mostraNoitesFora/mostraAlimentacao/mostraHorasExtra`
  (Boolean, default `true` — preserva o comportamento atual) — `db push` no Neon
- [x] `lib/validacao.ts` (`motoristaParamsSchema`), `MotoristaParamsForm.tsx`
  (3 checkboxes, secção "Campos visíveis no registo"),
  `/escritorio/motoristas/[id]/page.tsx`
- [x] `app/motorista/registo/page.tsx` busca os 3 campos do motorista da sessão
  (escritório vê sempre tudo — não regista em nome de nenhum motorista
  específico); `RegistoForm.tsx` esconde os 3 blocos condicionalmente
- [x] `ParagemEditor.tsx` (escritório) fica sem alteração — continua a mostrar
  sempre os 3 campos, independentemente do motorista
- [x] `tsc`/`vitest` (156, inalterados)/`next build` limpos; confirmado por
  leitura direta que os 2 motoristas reais mantiveram os defaults `true`
- [ ] Commit + push

## 🔲 Meias-paletes (2026-08-28)

Plano: `C:\Users\Ricardo\.claude\plans\steady-wondering-whisper.md`. Uma meia-palete
cabe em cima de outra já registada — não ocupa base própria (nunca entra na
capacidade/espaço), só vale metade no rateio.

- [x] Schema: `Paragem.nMeiasPaletes Float @default(0)` — `db push` no Neon
- [x] `lib/calc/perStop.ts`: numerador do coeficiente = `nPaletes + nMeiasPaletes×0,5`
  (2 caminhos, novo e legado); capacidade (denominador) inalterada;
  `coeficienteReal()` ganhou o mesmo 9º parâmetro
- [x] Fix lateral: `lib/calc/perRoute.ts::totalPaletes` não cobria o estilo novo
  (por dimensão) — só via `volume`/tipoVeiculo legado; corrigido
- [x] Fix lateral: `linhaDevisSchema` (`lib/validacao.ts`) não tinha
  `tipoPaleteId`/`paleteComprimentoMm`/`paleteLarguraMm`/`pesoAproximado` —
  o Zod descartava-os ao GUARDAR um orçamento (só estavam no schema de estimar)
- [x] UI: `RegistoForm.tsx`/`ParagemEditor.tsx`(modo paletes)/`OrcamentoForm.tsx`
  ganharam "Nº de meias-paletes" opcional; aviso de sobrecarga continua a
  comparar só `nPaletes` (base); novo aviso se meias > bases
- [x] 12 testes novos (144 → 156 no total), `tsc`/`vitest`/`build` limpos
- [x] Validado ponta-a-ponta contra o veículo real AO-33-PJ (nPaletes=20 +
  nMeiasPaletes=6 → coeficiente 23/38, exato)
- [x] `tasks/lessons.md` (bug lateral do totalPaletes/linhaDevisSchema) + commit
- [ ] **Push pendente**: credenciais do GitHub (Git Credential Manager) expiradas
  — `git push` falha com 401, precisa de reautenticação interativa (browser) que
  só o Ricardo consegue fazer a partir do terminal dele

## 📐 Distribuição por dimensões de palete (2026-08-28)

Plano: `C:\Users\Ricardo\.claude\plans\steady-wondering-whisper.md`. Paletes passam a ser
o único modo de rateio para paragens NOVAS (catálogo `TipoPalete`, 8 tamanhos, ocupação
por área em vez de nº fixo por tipo); peso aproximado por paragem alimenta a tabela de
consumos (deixa de ser sempre "vazio"). Rotas antigas por kg ficam como estão — o Ricardo
altera-as manualmente quando quiser.

- [x] Schema: `Veiculo.reboqueHabitualId`/`fatorOcupacaoPalete`, `Paragem.tipoPaleteId`/
  `paleteComprimentoMm`/`paleteLarguraMm`/`pesoAproximado` — aditivo, `db push` no Neon
- [x] `lib/calc/types.ts`: novos campos em `ParagemSnapshot`/`ParagemInput`/`ParagemCalc`
- [x] `lib/calc/perStop.ts`: `paletesQueCabem`, `capacidadePaleteDimensoes`, 3º caminho
  (testado primeiro) em `calcularParagem`/`coeficienteReal`, consumo usa `pesoAproximado`
  (paletes antigas e novas) — caminhos legados (string `tipoPalete`, fallback
  pré-migração) intocados
- [x] `lib/calc/snapshot.ts` + `lib/snapshot-service.ts`: congela caixa veículo +
  reboque habitual + fator no `ParagemSnapshot`
- [x] Escrita: `app/api/paragens/route.ts` + `[id]/route.ts` congelam dimensões do
  `TipoPalete` escolhido (`lib/rotas-service.ts::resolverPaleteDimensoes`);
  `lib/validacao.ts` torna `tipoPaleteId`+`nPaletes` obrigatórios (não-VAZIO, só
  escritas novas); passthrough em `paragemToInput`; `lib/calc/orcamento.ts` +
  `/api/devis/estimar` idem para orçamentos
- [x] UI: `VeiculosManager.tsx`/`VeiculoCamposForm.tsx` (reboque habitual + fator),
  `RegistoForm.tsx` (sem ramo `volume`, sempre tipoPalete+nPaletes+peso aproximado),
  `ParagemEditor.tsx` (3 modos: kg/paletes-legado/paletes, com botão "Converter para
  paletes" para o Ricardo migrar rotas antigas manualmente), `OrcamentoForm.tsx` (idem,
  exige veículo escolhido)
- [x] Ligados `AO-33-PJ→Lecitrailer`, `08-SC-33→Frenauf`; criados `1200x1200`/`1100x1000`
  no catálogo (8 tipos no total)
- [x] Testes novos (22: `perStop`/`perRoute`, incl. os 6 pares reais veículo×palete
  validados à mão), 144 testes verdes, `tsc`/`vitest`/`next build` limpos
- [x] Regressão confirmada contra produção: rota RIC-Francisco Lince Blowtec (Blo-sega
  32,25%/296,53€, Blowtec 1,88%/17,30€, Σquota=1.000000) — idêntico à lição de 22/08,
  zero alteração; caminho de escrita completo (snapshot + resolução de palete) validado
  ponta-a-ponta contra o veículo real AO-33-PJ
- [x] `tasks/lessons.md` (reversão parcial da regra 17/07 + desvio do Frenauf) + commit/push
- [ ] **Ação do utilizador**: decidir se ajusta `fatorOcupacaoPalete` do 08-SC-33 (~0,86
  reproduziria os 24 paletes atuais em vez dos 28 calculados pela geometria pura com o
  Frenauf) em `/escritorio/veiculos`

## 📦 Paletes: capacidade "só camião" vs "camião+reboque" (2026-08-22)

Pedido do Ricardo: os números de capacidade de paletes (38/28) foram
calibrados a pensar em camião+reboque — quando um motorista vai só de
camião (sem reboque) e carrega paletes, o sistema continuava a dividir
pelo número do conjunto todo, subestimando a ocupação real (ex.: 18
paletes num camião sozinho dava 18/38≈47% em vez de refletir que estava
a 100% da capacidade real). Mesma lacuna que já tinha sido resolvida para
peso (`capacidadeCamiao` vs `capacidadeReboque`), nunca replicada para
paletes. Plano completo:
`C:\Users\Ricardo\.claude\plans\groovy-giggling-noodle.md`.

- [x] `PALETE_120X80`/`PALETE_120X100` deixam de ser valores de "Tipo
  Veículo" — passam a `Paragem.volume` (boolean) + `Paragem.tipoPalete`,
  ortogonal ao Tipo Veículo normal (Camião/Camião+Reboque/Vazio). No
  motorista e no escritório: escolhe-se o veículo como sempre, aparece um
  checkbox "Volume" por baixo, e só então o tipo de palete + nº de paletes
  (substituindo os campos de KG)
- [x] `prisma/schema.prisma`: `capacidadePaleteACamiao`/`BCamiao` novos em
  `Parametros` e `Veiculo` (defaults 18/14 — exemplo real do Ricardo, um
  camião sozinho a full), ao lado dos existentes `capacidadePaleteA/B`
  (agora documentados como "camião+reboque"); `Paragem.volume`/`tipoPalete`
  novos. Tudo aditivo — um só `db push`, sem 2ª volta de "aperto" de schema
- [x] `lib/calc/perStop.ts`: novo par de helpers (`paleteEfetiva`,
  `capacidadePalete`) escolhe a capacidade certa consoante tipoVeiculo ×
  tipoPalete; `coeficienteReal` ganha 2 parâmetros novos opcionais
  (`volume`, `tipoPalete`), nunca obrigatórios — mesma regra já aplicada a
  `nPaletes` em 2026-07-14. Fallback de compatibilidade: `tipoVeiculo`
  ainda literalmente `PALETE_120X80`/`100` (dados pré-migração) continua a
  ser tratado como camião+reboque, tal como sempre foi
- [x] 3 pontos que faziam `Paragem`→`ParagemInput`/`ParagemEditavel` campo
  a campo (não spread) e por isso não tinham os campos novos, corrigidos:
  `lib/rotas-service.ts::paragemToInput()`, `app/escritorio/rotas/[idRota]/
  page.tsx::editavel()`, `app/motorista/historico/page.tsx` — sem isto os
  campos novos nunca chegariam ao motor nem ao editor em produção
  (encontrado ao seguir os consumidores, não estava no levantamento inicial)
- [x] Script de backfill (`prisma/migrate-paletes-volume.ts`) corrido contra
  a Neon de produção: 13 paragens reais migradas (`PALETE_120X80`→9,
  `PALETE_120X100`→4) para `tipoVeiculo=CAMIAO+REBOQUE, volume=true,
  tipoPalete=<valor antigo>`. Verificado por snapshot antes/depois das 7
  rotas afetadas via `carregarRota()` (custoTotalRota, coeficienteCarga,
  custoParagem por paragem, rateio) — **zero diferenças, histórico
  preservado ao cêntimo**
- [x] 119 testes verdes (`tests/calc/perStop.test.ts`,
  `perRoute.test.ts`, `orcamento.test.ts`, `snapshot.test.ts` atualizados
  para o novo formato + casos novos: CAMIAO sem reboque usa 18/14, e o
  fallback de compatibilidade continua a funcionar), `tsc --noEmit` e
  `next build` limpos
- [x] Testado ponta a ponta contra a BD de produção real (sessão forjada
  por HMAC, `next dev` local): `POST /api/paragens` com `tipoVeiculo:
  CAMIAO, volume:true` → coeficiente usa a capacidade "só camião" (18, não
  38/36); com `CAMIAO+REBOQUE` → usa a capacidade do conjunto (36, valor
  próprio deste veículo); `PATCH` a desligar `volume` → volta a peso/
  capacidadeCamiao corretamente; `PUT /api/parametros` alterando os 2
  campos novos → refletido no cálculo seguinte. Parâmetros globais
  repostos aos valores originais (18/14) e dados de teste apagados a
  seguir
- [x] Commit + push (Vercel builda automaticamente)
- [ ] **Ação do utilizador**: os defaults 18 (120×80) e 14 (120×100) são o
  exemplo que o Ricardo deu (camião sozinho a full) — confirmar em
  `/escritorio/parametros` (grupo "Paletes") e por veículo em
  `/escritorio/veiculos` se são mesmo os números reais de cada camião, e
  ajustar se não forem

## 🔧 Separador "Avarias" (motorista reporta → escritório vê/resolve) (2026-08-19)

Pedido do Ricardo: no motorista, um separador novo para reportar avarias
(data + veículo/matrícula + descrição do problema); aparece do lado da
administração em Veículos → Avarias. Confirmado com ele: modelo `Avaria`
novo e separado de `Manutencao` (essa alimenta o motor de custo do
veículo — valor/dias —, não deve misturar-se com sinalização informal do
motorista); e implementar já nos dois sítios — o site **e** a app Android
"Motorista" (bundle próprio, precisa de porte manual). Plano completo em
`C:\Users\Ricardo\.claude\plans\rustling-jumping-bird.md`.

- [x] `prisma/schema.prisma`: novo `model Avaria` (data, descricao,
  veiculoId→Veiculo, reportadoPorId→Utilizador opcional, resolvida,
  resolvidaEm) + relações inversas em `Veiculo`/`Utilizador`; `db push`
  aplicado em produção (aditivo, sem perda de dados)
- [x] `lib/validacao.ts`: `avariaSchema`/`avariaUpdateSchema`
- [x] `app/api/avarias/route.ts` (GET qualquer sessão, filtro
  `?resolvida=`; POST qualquer sessão, grava `reportadoPorId`) e
  `app/api/avarias/[id]/route.ts` (PATCH/DELETE só ESCRITORIO)
- [x] `/motorista/avarias` (nova aba na nav, a seguir a Histórico):
  formulário data/veículo/descrição + lista de avarias pendentes do
  veículo selecionado (evita reportes duplicados) — testado a 320px,
  sem overflow na nav (4 abas cabem exatamente como as 3 anteriores)
- [x] `/escritorio/veiculos/avarias`: tabela com marcar
  resolvida/reabrir/apagar; link "Avarias" com badge do nº pendentes no
  cabeçalho de `/escritorio/veiculos`
- [x] `tsc --noEmit` e `next build` limpos no site; testado ponta a ponta
  contra a BD de produção (sessão forjada por HMAC): POST como
  motorista, GET pendentes, PATCH resolvida e DELETE como escritório,
  401/403 confirmados nos casos sem permissão, dados de teste apagados
- [x] App Android Motorista (`app-motorista-android`, sem git):
  `src/lib/types.ts`/`api.ts` (novo `Avaria`/`criarAvaria`/
  `carregarAvariasPendentes`), `src/screens/Avarias.tsx` (novo, espelha
  `Registar.tsx`), `src/App.tsx` (nova aba) — `npm run build` limpo,
  testado ponta a ponta contra a API de produção real via proxy do Vite
  dev (sessão forjada por HMAC injetada em `localStorage` como
  `@capacitor/preferences` faz no browser): reportar avaria → 201,
  aparece na lista de pendentes do veículo, dados de teste apagados a
  seguir
- [x] Novo `app-release.apk` assinado gerado
  (`android/app/build/outputs/apk/release/`)
- [x] Commit + push do site (Vercel build automático, confirmado
  `/api/avarias` a responder em produção)
- [x] **Extra (mesmo dia)**: botão "Enviar email" (mailto: com
  assunto/corpo pré-preenchidos, mesmo padrão do `EnviarOrcamento.tsx`) —
  em cada linha de `/escritorio/veiculos/avarias` e após o motorista
  reportar em `/motorista/avarias`; sem destinatário fixo (app não tem
  email de oficina guardado). Portado também para a app Android
  (`Avarias.tsx`) e `.apk` regerado. Testado: href do mailto confirmado
  com assunto/corpo corretos nos dois lados do site (Playwright), dados
  de teste apagados
- [x] **Extra (mesmo dia)**: nome visível trocado para "Pedido
  Manutenção" (títulos, botões, mensagens, assunto do email) — a pedido
  do Ricardo, só o texto (rotas `/motorista/avarias`, o modelo Prisma
  `Avaria` e nomes de ficheiros/variáveis continuam "avaria" no código,
  decisão explícita). Rótulo mais comprido cortava "Perfil" na nav do
  motorista a 320px — nav passou a `flex-wrap` (quebra para 2 linhas em
  vez de cortar), confirmado sem overflow a 320px e 390px. Portado
  também para a app Android, `.apk` regerado outra vez
- [ ] **Ação do utilizador**: reinstalar (sideload) o novo `.apk` no
  telemóvel do motorista para a aba "Pedido Manutenção" (+ email)
  aparecer

## 🧾 PDF de pagamentos dos clientes (2026-08-19)

Pedido do Ricardo: tal como já existe "Descarregar PDF" no orçamento
(`/api/devis/[id]/pdf` + `EnviarOrcamento.tsx`), fazer o mesmo para os
pagamentos/cobranças dos clientes. Confirmado com o Ricardo: **ambos** —
(1) extrato por cliente (paragens em dívida desse cliente + total, pronto
a enviar como cobrança) e (2) exportação em PDF da tabela inteira "Contas
a receber".

- [x] `lib/pdf/empresa.ts` (novo): extrai a constante `EMPRESA` de
  `DevisDocument.tsx` para ficheiro partilhado (usada pelos 2 documentos
  novos também) — puramente um refactor, sem mudar o PDF do orçamento
- [x] `lib/cobrancas-service.ts` (novo): extrai a query+mapeamento que hoje
  vive só em `app/escritorio/cobrancas/page.tsx` para uma função
  `carregarCobrancas()` reutilizável (página + rota da API do PDF);
  `LinhaCobranca` passa a viver aqui (não duplicado em `CobrancasTabela.tsx`)
- [x] `lib/pdf/CobrancasDocument.tsx` (novo): PDF da tabela "Contas a
  receber" inteira (todas as linhas, tal como a página) + resumo (por
  receber/vencido)
- [x] `lib/pdf/ExtratoClienteDocument.tsx` (novo): PDF "extrato de conta"
  de um cliente (só as paragens por pagar + total/vencido) — mesmo estilo
  visual do `DevisDocument.tsx`
- [x] `app/api/cobrancas/pdf/route.ts` (novo): GET, só ESCRITORIO, gera o
  PDF da tabela inteira
- [x] `app/api/clientes/[nome]/pdf/route.ts` (novo): GET, só ESCRITORIO,
  gera o extrato de um cliente (nome vem da URL, `decodeURIComponent`;
  `Content-Disposition` sanitizado + `filename*` RFC 5987 para acentos)
- [x] `components/DescarregarPdfBotao.tsx` (novo): botão cliente
  genérico (fetch blob + download), reutilizado nos 2 sítios em vez de
  duplicar a lógica que já existe em `EnviarOrcamento.tsx`
- [x] `app/escritorio/cobrancas/page.tsx`: usa `carregarCobrancas()` +
  botão "Descarregar PDF" da tabela inteira (só aparece com linhas)
- [x] `app/escritorio/clientes/page.tsx`: botão "Descarregar extrato
  (PDF)" no detalhe do cliente selecionado, junto ao cartão "Pagamentos"
- [x] `tsc --noEmit` limpo, `next build` OK (2 rotas novas confirmadas no
  output: `/api/cobrancas/pdf`, `/api/clientes/[nome]/pdf`)
- [x] Testados os 2 PDFs contra a BD de produção real (sessão forjada por
  HMAC, `next dev` local): tabela inteira (25 paragens reais, todas pagas)
  → 200, `%PDF-1.3`; extrato por cliente com saldo real 0 → 200, ramo
  "sem valores"; extrato com 1 paragem de teste por pagar (250 €, criada e
  apagada a seguir) → 200, PDF maior (ramo da tabela populada exercido)
- [x] Commit + push (Vercel builda automaticamente)

## 🗺️ Vamos ao dia de ontem — roteiro geral (2026-08-16)

Levantamento pedido pelo Ricardo ("o que falta fazer nesta app"), a partir de
uma leitura completa deste ficheiro. A esmagadora maioria do que falta já não
é código — é dados/configuração da parte dele. Artefacto publicado:
https://claude.ai/code/artifact/7fdf773c-38bc-475f-9c24-a0d0117506e9

### Agora — risco ativo
- [ ] Trocar os PINs por defeito em produção (escritório `1234`, motorista
  `0000`) — a funcionalidade já existe (`/escritorio/parametros` e
  `/escritorio/motoristas/[id]`), só falta usá-la (ver também linha ~1061
  abaixo, o mesmo item já estava por fazer desde 2026-08-11)

### Dados/configuração pendente (ação do Ricardo, sem código)
- [ ] Marcar "Blo-Synergy" com "Faturar esta recolha a → Blowtec" em
  `/escritorio/rotas/RIC-Tec-eurored`
- [ ] Marcar Tec-masterferro, Tec-A2 e Blo-Synergy como "Recolha para
  entregar a outro cliente" na mesma rota
- [ ] Preencher dimensões (mm) dos veículos reais em `/escritorio/veiculos`
  e registar os reboques reais em `/escritorio/reboques`
- [ ] Ajustar capacidade/peso médio por palete em `/escritorio/parametros`
  (grupo "Paletes") se os defaults não forem os reais
- [ ] Sincronizar a tabela de portagens por zona com a folha
  `Tabela_ConsPort` do Excel, em `/escritorio/parametros`
- [ ] (Opcional) `TOLLGURU_API_KEY` na Vercel, só se quiser portagens
  automáticas por rota em vez da tabela fixa
- [ ] Instalar o novo `app-release.apk` da app Motorista (ícones de
  despesas de 2026-08-16); copiar os 2 keystores Android + passwords para
  backup seguro

### Engenharia por construir
- [ ] App Motorista Android — sincronização offline (Fase 2, Entrega 2:
  SQLite + fila de paragens por sincronizar) — maior bloco de trabalho
  pendente no projeto Android, ver secção própria abaixo
- [ ] Fase 3 — distribuição das apps Android (validar Motorista num
  telemóvel real, processo de partilha do `.apk`)
- [ ] Upgrade major do Next.js (14→16) — corrige as CVEs restantes de
  DoS/SSRF/cache poisoning, mas exige React 19 e teste dedicado (adiado na
  auditoria de segurança de 2026-08-16, ver `tasks/lessons.md`)
- [ ] Substituir o pacote `xlsx` (prototype pollution/ReDoS sem correção),
  usado em `/api/importar` — troca de biblioteca merece teste próprio
  contra ficheiros reais antes de produção
- [ ] Multi-tenant, se decidir vender a app a outras empresas — 0%
  começado: `empresaId` no schema Prisma propagado a todas as queries,
  sessão a resolver a empresa, billing por cima, onboarding self-service

### Opcionais menores
- [ ] Logo/ícone próprio para a app Motorista (hoje reaproveita o da
  Administração)
- [ ] Personalizar o cabeçalho da empresa no PDF de orçamentos (constante
  `EMPRESA` em `lib/pdf/DevisDocument.tsx`)

## ⛽ Link para preços de referência ENSE (rota + motorista) (2026-08-15)

Pedido do Ricardo: botão com o link oficial da ENSE
(ense-epe.pt/precos-de-referencia) no detalhe da rota (onde já se corrige
o preço de referência), e um sítio discreto para o motorista consultar
o preço quando precisa dele para preencher uma guia.

- [x] `/escritorio/rotas/[idRota]`: link "⛽ Ver preços de referência
  (ENSE) ↗" no cartão "Combustível desta rota"
- [x] `components/LinkPrecoReferencia.tsx` (novo): botão flutuante
  discreto (ícone ⛽), montado em `app/motorista/layout.tsx` ao lado da
  Calculadora já existente — posicionado `fixed`, não mexe no
  cabeçalho de navegação (evita o overflow a 320px já corrigido antes)
- [x] `tsc --noEmit` limpo, 114 testes verdes, `next build` OK

## ⛽ Poupança combustível Espanha — relatório no dashboard (2026-08-13)

Pedido do Ricardo: um "apanhado" do combustível abastecido em Espanha —
por dia, quanto se poupou vs. preço de referência, e o total ao longo dos
meses. Só comparação/relatório, sem tocar em nenhuma fórmula de custo (os
campos `litrosEspanha`/`custoEspanha`/`poupancaEspanha` já existiam,
puramente informativos, desde 2026-06).

- [x] `lib/dashboard-service.ts`: `carregarPoupancaEspanha()` — agrega o
  `poupancaEspanha` que `calcularParagem()` já devolve por paragem, por
  dia e por mês; total "últimos 12 meses" calculado sobre a janela
  móvel a partir de hoje
- [x] `app/escritorio/dashboard/espanha/page.tsx` (novo): tabela "Por
  mês" + tabela "Por abastecimento" (data/rota/cliente/litros/preço
  ref./custo pago/poupança); valores negativos a vermelho (abastecimento
  que saiu mais caro que a referência — apanhado num teste real)
- [x] Cartão no dashboard principal (só aparece se houver dados) com KPI
  "últimos 12 meses"/"total acumulado" e link para o detalhe
- [x] 114 testes verdes, `tsc --noEmit` limpo, `next build` OK
- [x] Testado contra a BD de produção real: dados reais existentes
  (876,06 € nos últimos 12 meses, meses de Maio–Agosto 2026 discriminados
  corretamente, incl. uma linha negativa real detetada e corrigida a
  vermelho)

## 📊 Dashboard: "Estrutura de custos" em barras + página de detalhe por rota (2026-08-13)

Pedido do Ricardo: o gráfico de despesas no dashboard passa de pizza para
barras; clicar nele abre uma página com tabela discriminando tudo.

- [x] `Charts.tsx`: `GraficoEstrutura` passa de `PieChart` para `BarChart`
  (mesmo estilo dos outros gráficos de barras do dashboard)
- [x] `app/escritorio/dashboard/page.tsx`: cartão "Estrutura de custos"
  passa a `<Link>` para `/escritorio/dashboard/despesas`
- [x] `app/escritorio/dashboard/despesas/page.tsx` (novo): tabela com uma
  linha por rota × as 6 categorias (Combustível/Motorista/Veículo/
  Portagens/AdBlue/Noites-Alim.-Horas) + linha de totais; cada rota liga
  para `/escritorio/rotas/[idRota]`
- [x] `lib/dashboard-service.ts`: nova `carregarDespesasDetalhe()` +
  `despesasPorRota()` (privada, partilhada com `carregarDashboard`)
- [x] **Bug real encontrado e corrigido de caminho**: a "Estrutura de
  custos" original recalculava o custo por paragem isoladamente
  (`calcularParagem` direto), sem o ajuste de `pesoEmTransito` que
  `calcularRotas()` aplica (rotas multi-paragem no mesmo dia/direção) —
  o total da estrutura de custos não batia com o KPI "Custo total"
  (diferença real de ~1 286 € encontrada nos dados de produção).
  `despesasPorRota()` passou a derivar de `RotaCalc` (já calculado por
  `calcularRotas`) em vez de recalcular — Σ tabela = KPI ao cêntimo agora
- [x] 114 testes verdes, `tsc --noEmit` limpo, `next build` OK
- [x] Testado contra a BD de produção real (sessão forjada por HMAC): as
  duas páginas devolvem 200; confirmado que o total da tabela nova
  (21 491,15 €) bate exatamente com o KPI "Custo total" do dashboard

## 🐛 Fix: erro 500 ao registar paragem (app Motorista) — ligação direta à Neon em serverless (2026-08-13)

Reportado pelo Ricardo ao testar a Fase 3 (validação real da app Motorista no
telemóvel): erro 500 a registar uma paragem com paletes (rota nova); ao
tentar de novo, a paragem já estava gravada — a escrita chegava a completar-
se na BD, mas a resposta falhava. Reproduzido localmente com o payload exato
da app (funcionou sempre) — a diferença estava na configuração da ligação à
BD em produção, não no código do endpoint. Ver detalhe em `tasks/lessons.md`.

- [x] Diagnóstico: `DATABASE_URL` na Vercel usava a ligação **direta** da
  Neon (sem `-pooler`) — em serverless, cada invocação abre a sua própria
  ligação, esgotando o limite da Neon / sofrendo o "acordar" do compute
  suspenso, causando 500 intermitentes mesmo com a escrita já efetuada
- [x] `prisma/schema.prisma`: `datasource db` ganha `directUrl` (nova env
  var `DIRECT_URL`, só para `prisma db push`/`migrate`); `DATABASE_URL`
  passa a ser a "Pooled connection" da Neon (`pgbouncer=true&connection_limit=1`)
- [x] `.env` local e `.env.example` atualizados com as 2 variáveis e a
  explicação de qual é qual
- [x] Vercel: `DIRECT_URL` adicionada (valor = antiga ligação direta),
  `DATABASE_URL` trocada para a pooled — feito pelo Ricardo no dashboard
- [x] Testado: `prisma db push` continua a funcionar (confirma que usa a
  ligação direta); query real via `DATABASE_URL` pooled funciona; 114
  testes verdes, `tsc --noEmit` limpo, `next build` OK
- [x] **Confirmado em produção real** depois do deploy: 3 pedidos seguidos
  de `POST /api/paragens` (payload idêntico ao que a app Motorista envia,
  paletes + rota nova) — todos `201`, sem nenhum 500. Dados de teste
  apagados a seguir (`RIC-TesteProducaoPoolFix`/`2`/`3`)

## 🔐 Alterar PIN (escritório + motorista) (2026-08-11)

Pedido do Ricardo: rever "o que falta" de segurança/config. Confirmado por
leitura direta da BD que os 2 únicos utilizadores ainda usavam os PINs por
defeito (escritório 1234, motorista "Ricardo" 0000) — e não existia nenhuma
forma de os mudar pela app (só `POST /api/motoristas` definia um PIN, ao
criar; não havia PATCH nenhum).

- [x] `lib/validacao.ts`: `alterarPinEscritorioSchema` (exige `pinAtual` +
  `pinNovo`) e `alterarPinMotoristaSchema` (só `pin`, já que o escritório tem
  autoridade sobre a conta do motorista)
- [x] `PATCH /api/auth/pin` — escritório muda o seu próprio PIN, valida o PIN
  atual por bcrypt antes de aceitar o novo
- [x] `PATCH /api/motoristas/[id]/pin` — escritório muda o PIN de um
  motorista, sem precisar do PIN antigo
- [x] UI: cartão "Segurança — Alterar PIN do Escritório" em
  `/escritorio/parametros`; "Alterar PIN" na ficha de cada motorista
  (`/escritorio/motoristas/[id]`)
- [x] Testado de ponta a ponta contra a BD real (curl, sessão forjada por
  HMAC com o `AUTH_SECRET` local): sem sessão → 403; PIN atual errado → 401;
  PIN novo curto → 400; ciclo completo alterar → login com o PIN novo → repor
  o original → login de novo, para os 2 utilizadores — PINs de produção
  restaurados aos valores originais no fim dos testes
- [x] De caminho, confirmado em produção (mesmo método) que `ORS_API_KEY`
  está configurada (km automático real: Lisboa→Porto = 315 km) mas
  `TOLLGURU_API_KEY` **não está** — portagens automáticas nunca chegaram a
  ligar, a app usa sempre a tabela por zona (fallback já existente, nada
  partido)
- [ ] **Ação do utilizador**: ir a `/escritorio/parametros` e definir um PIN
  novo para o Escritório; ir à ficha do motorista em
  `/escritorio/motoristas/[id]` e definir um PIN novo para ele também — os
  valores por defeito (1234/0000) continuam ativos até isto ser feito

## 🧾 Histórico do motorista mostra quantas zonas de portagem por rota (2026-08-11)

Pedido do Ricardo: no Histórico do motorista, mostrar quantas vezes o
campo "Zona Portagem" foi preenchido por rota, para o motorista perceber
de relance se já registou a portagem e evitar duplicar/sobrecustar.

- [x] `app/motorista/historico/HistoricoMotorista.tsx`: cabeçalho de cada
  rota ganha `N zona(s) de portagem` (conta paragens com `zonaPortagem`
  não vazio), ao lado do nº de paragens/noites/alimentação já existentes
- [x] Não mexe no motor de cálculo — `tsc --noEmit` limpo, `next build`
  OK, 114 testes continuam verdes

## 🚚 Motorista só assinala "Recolha"; escolher o cliente fica só no escritório (2026-08-11)

Ajuste ao pedido de há pouco: o dropdown "Faturar esta recolha a" no
formulário do motorista foi trocado por um checkbox simples "Recolha",
colocado logo acima de "KG Carregados" — o motorista só assinala, não
escolhe destino. A escolha do cliente a faturar continua só no escritório
(`ParagemEditor.tsx`, dropdown inalterado).

- [x] Schema: novo `Paragem.recolha Boolean @default(false)` (separado de
  `faturarCliente`) — puramente aditivo, `db push` sem avisos de perda de
  dados
- [x] `lib/validacao.ts`, `lib/calc/types.ts` (`ParagemInput`/`ParagemCalc`),
  `lib/calc/perStop.ts` (passthrough), `lib/rotas-service.ts`,
  `app/api/paragens/route.ts` — `recolha` é só informativo, **não entra no
  rateio** (só `faturarCliente` afeta o cálculo, inalterado)
- [x] `RegistoForm.tsx`: removido o dropdown de clientes; checkbox
  "Recolha" acima de KG Carregados; reset após submeter
- [x] `app/escritorio/rotas/[idRota]/page.tsx`: badge da tabela distingue
  "recolha → Cliente" (já atribuída, âmbar) de "recolha — por atribuir"
  (assinalada pelo motorista mas ainda sem destino, vermelho) — dá ao
  escritório uma forma visual de saber o que falta rever
- [x] 114 testes verdes (motor de cálculo não mudou, `recolha` não afeta
  rateio), `tsc --noEmit` limpo, `next build` OK
- [ ] **Verificação manual**: no registo do motorista, marcar "Recolha" e
  gravar; confirmar em `/escritorio/rotas/<idRota>` que aparece o badge
  vermelho "por atribuir"; editar essa paragem e escolher o cliente no
  dropdown do escritório — badge passa a âmbar "recolha → Cliente" e o
  rateio atualiza

## 🔀 Recolhas: escolher A QUEM faturar (dropdown), não só excluir (2026-08-11)

Evolução do pedido de ontem: o Ricardo já tinha usado a checkbox "não
faturar a este" em 4 paragens reais (Tec-junqueira, Tec-Viveres ferry,
Tec-masterferro, Tec-A2, todas na rota RIC-Tec-eurored) — mas com só um
boolean, o custo diluía-se por TODOS os clientes faturáveis da rota, não
só pelo cliente final certo. Pedido: um campo "Faturar esta recolha a"
com dropdown dos clientes conhecidos (mesma lista usada em Orçamentos),
para atribuir o custo especificamente à Tecfil/Blowtec/etc.

- [x] Schema: `Paragem.naoFaturarCliente` (boolean) substituído por
  `Paragem.faturarCliente String?` (nome do cliente a faturar; null =
  fatura normalmente ao próprio `cliente`) — **dados reais migrados**, não
  perdidos: as 4 paragens já marcadas foram lidas por SQL antes do drop da
  coluna antiga e reescritas como `faturarCliente = "Tecfil"` (confirmado
  pelo próprio Ricardo: "todos os kg em kg carregados são para a Tecfil"
  nesta rota) — sequência seguida: adicionar coluna nova → migrar dados →
  só depois `db push --accept-data-loss` a remover a antiga
- [x] `lib/calc/perRoute.ts`: `chave = p.faturarCliente || p.cliente` no
  rateio — o coeficiente da recolha SOMA-se à quota do cliente indicado
  (não dilui por todos); `lib/calc/types.ts`, `perStop.ts`,
  `lib/rotas-service.ts`, `lib/validacao.ts`, APIs — mesmo padrão de antes,
  só trocando boolean por string
- [x] UI: checkbox trocada por `<select>` "Faturar esta recolha a" em
  `RegistoForm.tsx` (motorista, usa a lista `clientes` já existente no
  formulário) e `ParagemEditor.tsx` (escritório + Histórico do motorista,
  nova prop `clientes` alimentada por `listarNomesClientes()` — mesma
  função já usada em Orçamentos, não duplicada); badge da tabela de
  Paragens passa a mostrar "recolha → {cliente}" em vez de só "recolha"
- [x] 3 testes novos substituem/complementam os 4 de ontem em
  `tests/calc/perRoute.test.ts` — prova explícita de que a recolha soma
  ao cliente indicado e NÃO dilui pelos outros (`Cliente Outro` mantém o
  seu coeficiente inalterado) — 114 testes verdes no total, `tsc
  --noEmit` limpo, `next build` OK
- [x] Confirmado contra a BD real: as 4 paragens migradas já aparecem com
  `faturarCliente: "Tecfil"`; rateio real da rota RIC-Tec-eurored já não
  mostra Tec-junqueira/Tec-masterferro/Tec-A2 como linhas próprias (Tecfil
  subiu de 179,63 € para 359,26 €, absorvendo o custo certo)
- [ ] **Ação do utilizador**: falta só a Blo-Synergy (recolha de 4 paletes)
  — não estava nas 4 já marcadas, por isso não foi migrada automaticamente;
  ir a `/escritorio/rotas/RIC-Tec-eurored`, editar essa paragem e escolher
  "Blowtec" no novo dropdown "Faturar esta recolha a"

## 💰 Recolhas: não faturar ao fornecedor, faturar ao cliente final (2026-08-10)

Bug de negócio real encontrado ao investigar a rota `RIC-Tec-eurored`: uma
recolha (ex. material defeituoso, paletes vazias) entregue mais tarde a
outro cliente na mesma rota gerava linha própria no rateio — **o
fornecedor da recolha e o cliente final eram os dois cobrados pelo mesmo
material**. Confirmado com números reais: Tec-masterferro (44,38 €),
Tec-A2 (47,62 €) e Blo-Synergy (120,31 €) pagavam a recolha, e a Tecfil
(179,63 €)/Blowtec (120,31 €) pagavam outra vez a entrega do mesmo
material.

- [x] Schema: `Paragem.naoFaturarCliente Boolean @default(false)` — `db
  push` feito no Neon (default preserva 100% do histórico/rateio já
  calculado)
- [x] `lib/calc/types.ts` (`ParagemInput`/`ParagemCalc`), `lib/calc/perStop.ts`
  (passthrough), `lib/calc/perRoute.ts` — paragens `naoFaturarCliente` ficam
  de fora do rateio por cliente (mesmo tratamento que `VAZIO`), mas continuam
  a contar para custo total/consumo/histórico
  — o custo dilui-se nos clientes faturáveis da rota
- [x] `lib/validacao.ts`, `lib/rotas-service.ts` (`paragemToInput`),
  `app/api/paragens/route.ts` (PATCH herda automaticamente via
  `paragemSchema.partial()`)
- [x] UI: checkbox "Recolha para entregar a outro cliente (não faturar a
  este)" em `RegistoForm.tsx` (motorista) e `ParagemEditor.tsx`
  (escritório + Histórico do motorista); badge "recolha" + nota explicativa
  na tabela de Paragens/Rateio de `app/escritorio/rotas/[idRota]/page.tsx`
- [x] 4 testes novos em `tests/calc/perRoute.test.ts` (reproduzem o cenário
  real: fornecedor não aparece no rateio, cliente final paga 100%, custo da
  recolha continua incluído no total, Σ custoAtribuido = custoTotalRota) —
  111 testes verdes no total, `tsc --noEmit` limpo, `next build` OK
- [x] Confirmado contra a BD real: coluna existe (default `false`), rateio
  atual da rota `RIC-Tec-eurored` ainda mostra o duplo-cobrar (nada mudou
  retroativamente, como esperado)
- [ ] **Ação do utilizador**: em `/escritorio/rotas/RIC-Tec-eurored`, editar
  as paragens Tec-masterferro, Tec-A2 e Blo-Synergy e marcar "Recolha para
  entregar a outro cliente" em cada uma — o rateio passa a atribuir esse
  custo só à Tecfil/Blowtec
- [ ] **Verificação manual**: no registo do motorista, marcar a checkbox
  numa recolha e confirmar que essa paragem não aparece no rateio da rota
  (mas continua na lista de Paragens, com o badge "recolha")

## 🔧 Aviso de inspeção do veículo ao motorista (2026-08-10)

Pedido do Ricardo: ao selecionar o veículo no registo, avisar o motorista se
o veículo tem inspeção a chegar (45 dias/mês e meio antes do prazo) ou já
vencida. O escritório define o prazo e confirma quando a inspeção é feita,
o que cala o aviso até ao próximo prazo.

- [x] Schema: `Veiculo.dataLimiteInspecao DateTime?` +
  `Veiculo.inspecaoVerificada Boolean @default(false)` — `db push` feito no
  Neon (confirmado por leitura direta: veículo existente ficou com
  `null`/`false`)
- [x] `lib/validacao.ts` (`veiculoSchema`) + `lib/veiculo-form.ts`
  (`VeiculoLike`/`VeiculoForm`/`veiculoParaForm`) — novos campos
- [x] `components/VeiculoCamposForm.tsx` — campo de data + checkbox "Já foi
  à inspeção" (desabilitado sem data); editar a data desmarca a checkbox
  no próprio formulário (espelha a regra do servidor)
- [x] APIs `app/api/veiculos/route.ts` (POST) e `.../[id]/route.ts` (PATCH)
  — conversão string→Date; no PATCH, mudar `dataLimiteInspecao` para uma
  data diferente da gravada força `inspecaoVerificada = false`
  automaticamente (decisão confirmada com o Ricardo: reset automático, para
  nunca ficar um aviso silenciado por engano num prazo novo)
- [x] `app/motorista/registo/RegistoForm.tsx` — novo aviso no mesmo padrão
  dos `avisos` já existentes (capacidade/zona), reage à seleção do veículo:
  "Este veículo tem de ir à inspeção até dd/mm/aaaa" (ou "já devia ter
  ido..." se o prazo já passou), a partir de 45 dias antes; `page.tsx`
  passa os 2 campos novos (convertidos para ISO string)
- [x] `tsc --noEmit` limpo, `next build` OK, 107 testes verdes (motor de
  cálculo não mudou)
- [ ] **Verificação manual (utilizador)**: em `/escritorio/veiculos/[id]`,
  definir uma data limite de inspeção próxima (dentro de 45 dias) num
  veículo ativo; ir a `/motorista/registo`, selecionar esse veículo e
  confirmar o aviso amarelo; marcar "Já foi à inspeção" e confirmar que o
  aviso desaparece; mudar a data para outra diferente e confirmar que a
  checkbox volta a ficar desmarcada (e o aviso reaparece se dentro dos 45
  dias)

## ☑️📄 Seleção manual em Cobranças + PDF (2026-08-20)

Pedido do Ricardo, a seguir ao agrupamento por empresa: poder procurar
por ex. "Plasgal", ver todas as linhas dessa empresa, marcar à mão quais
(pagas ou não) entram, e descarregar um PDF só dessa seleção.

- [x] Caixa de pesquisa em Cobranças passa a filtrar também por nome de
  empresa (antes só cliente/rota)
- [x] `components/CobrancasTabela.tsx`: checkbox por linha + checkbox
  "selecionar tudo" no cabeçalho de cada grupo (independente do estado
  Pago — pode misturar pagas e não pagas na seleção); barra de ação
  "N selecionada(s) — Descarregar PDF da seleção" aparece assim que há
  1+ marcada
- [x] `lib/cobrancas-service.ts`: `carregarCobrancasPorIds(ids)` (nova,
  reaproveitando o mesmo mapeamento de `carregarCobrancas()`, agora
  extraído para uma função partilhada `mapearLinhas`)
- [x] `lib/pdf/CobrancasDocument.tsx`: ganha `titulo` opcional (default
  "CONTAS A RECEBER") — usado para o PDF de seleção, com o nome da
  empresa quando toda a seleção pertence à mesma
- [x] `POST /api/cobrancas/pdf` (novo, mesma rota do `GET` já existente):
  recebe `{ids[], titulo?}`, só ESCRITORIO; nome do ficheiro sanitizado
  + `filename*` RFC 5987 (mesmo padrão do extrato por cliente)
- [x] `tsc --noEmit`, `next build` limpos
- [x] Testado com sessão forjada por HMAC: `POST` como MOTORISTA → 403,
  como ESCRITORIO → 200 com `%PDF-1.3` real (5 linhas reais de Tec-A2);
  confirmado visualmente (Playwright) que pesquisar "Tecfil" filtra
  pelas linhas dessa empresa e a barra de seleção aparece ao marcar
- [x] De caminho, confirmado que o Ricardo já tinha usado a ferramenta
  "Atribuir empresa" sozinho entretanto — 89 clientes já classificados
  pelas 5 empresas (Blowtec, Gesplast, Plasgal, Sacofilme, Tecfil)

## 🏢 Agrupar Cobranças por empresa-mãe (2026-08-20)

Pedido do Ricardo: trabalha para 4-5 empresas (Tecfil, Blowtec, Plasgal,
Sacofilme, Gesplast) — os clientes finais onde entrega pertencem a uma
delas, e é a essa empresa que se cobra. Os nomes de cliente já trazem um
prefixo informal (`Tec-`, `Blo-`, `Plas-`, `Sac-`, `Ges-`), mas
inconsistente (confirmado por leitura direta dos ~80 nomes distintos em
produção — espaços variáveis, erros como "Blow-egiquimica" em vez de
"Blo-"). Decisão do Ricardo: atribuição **explícita** por cliente (não
adivinhada automaticamente em runtime), numa ferramenta nova; Cobranças
passa a agrupar com subtotal por empresa, sem clique-para-ordenar (trade-
off aceite).

- [x] `prisma/schema.prisma`: novo modelo `Empresa` (nome único) +
  `Cliente.empresaId` opcional (`Cliente.nome` já é a chave única que
  corresponde a `Paragem.cliente`) — `db push` aditivo, sem risco
- [x] Semeadas as 5 empresas conhecidas (Tecfil, Blowtec, Plasgal,
  Sacofilme, Gesplast) — só isto; nenhum cliente atribuído
  automaticamente por mim (evita classificar mal casos ambíguos como
  "Base"/"Gaudêncio"/"carga A2", que não batem com nenhum prefixo)
- [x] `lib/empresas-service.ts` (novo): `listarEmpresas()`,
  `mapaClienteEmpresa()`
- [x] `app/api/empresas/route.ts` (novo): GET (qualquer sessão), POST
  (criar empresa nova, só escritório)
- [x] `app/api/clientes/empresas/route.ts` (novo): POST
  `{nomes[], empresaId}` — atribuição em massa, só escritório, upsert de
  `Cliente` (mesmo padrão já usado em `/api/clientes/agrupar`)
- [x] `app/api/clientes/agrupar/route.ts`: `empresaId` passa a fazer
  parte da fusão de fichas (mesma lógica "primeiro valor não-nulo
  vence" já usada para contato/telefone/email) — uma variante já
  classificada não perde a empresa ao ser fundida no nome canónico
  (testado: variante com Tecfil fundida num nome novo → canónico ficou
  com Tecfil)
- [x] `app/escritorio/clientes/empresas/page.tsx` +
  `components/AtribuirEmpresa.tsx` (novos, clonados de
  `AgruparClientes.tsx`): lista com busca + checkboxes, mostra a
  empresa já atribuída por cliente, dropdown de empresa + "+ Criar"
  inline, botão "Sugerir por prefixo" (client-side, só pré-marca para
  revisão — nunca atribui sozinho); link "Atribuir empresa" em
  `/escritorio/clientes`
- [x] `lib/cobrancas-service.ts`: `LinhaCobranca` ganha `empresa: string
  | null`; `components/CobrancasTabela.tsx` reescrito para agrupar por
  empresa com subtotal "por receber" + nº vencidas por grupo ("Sem
  empresa atribuída" sempre por último); mantém a pesquisa, perde o
  clique-para-ordenar por coluna (confirmado com o Ricardo)
- [x] `tsc --noEmit` e `next build` limpos
- [x] Testado ponta a ponta com sessão forjada por HMAC: `POST
  /api/clientes/empresas` como MOTORISTA → 403, como ESCRITORIO → 200;
  atribuídos 2 clientes reais (Tec-junqueira, Tec-A2 → Tecfil) e
  confirmado por leitura direta; Cobranças confirmada visualmente
  (Playwright) a agrupar sob "Tecfil" com subtotal, resto em "Sem
  empresa atribuída"; fusão de variante com empresa testada e limpa a
  seguir
- [x] Deixadas as 2 atribuições reais (Tec-junqueira/Tec-A2 → Tecfil)
  como exemplo de trabalho — não são dados de teste, são classificação
  real correta
- [ ] **Ação do utilizador**: usar `/escritorio/clientes/empresas` para
  classificar os restantes ~78 nomes de cliente pelas 5 empresas (ou
  criar mais, se houver)

## ☑️ Checklist no Pedido de Manutenção (2026-08-20)

Pedido do Ricardo (com screenshot): o campo "Descrição do problema" era
texto livre; várias situações escritas linha a linha. Passa a ter uma
checklist real — cada linha vira um item marcável, motorista **e**
escritório podem ir confirmando o que já foi resolvido, item a item.
Confirmado por leitura direta da BD que já havia 1 pedido real em
produção (id 7, veículo AO-33-PJ, 6 linhas) — migrado sem perder dados
antes de alterar o schema (mesmo cuidado da migração "Noites" em
2026-06-07).

- [x] `prisma/schema.prisma`: `Avaria.descricao` (String) → `itens`
  (`Json`, array `{id, texto, resolvido}`) + `observacoes` (`String?`,
  novo). Sequência: 1) `db push` aditivo (itens/observacoes opcionais,
  descricao mantida) 2) script único a dividir `descricao` por linha e
  gravar em `itens` 3) confirmado por leitura direta 4) `db push` final
  (`itens` obrigatório, `descricao` removida) — avaria real id 7
  confirmada intacta com os 6 itens no fim
- [x] `lib/validacao.ts`: `avariaSchema` passa a exigir `itens: string[]`
  (mín. 1) + `observacoes` opcional; `avariaUpdateSchema` fica só com
  `observacoes`/`data` (campos administrativos); novo
  `avariaItemUpdateSchema` (`resolvido: boolean`)
- [x] `app/api/avarias/[id]/itens/[itemId]/route.ts` (novo): `PATCH`,
  **qualquer sessão autenticada** (motorista ou escritório — pedido
  explícito do Ricardo), alterna 1 item dentro do array `itens` e
  recalcula `resolvida`/`resolvidaEm` sempre a partir de todos os itens
  (nunca editado à parte)
- [x] `app/api/avarias/route.ts` (POST): constrói `itens` a partir do
  array de textos enviado; `app/api/avarias/[id]/route.ts` (PATCH): só
  ESCRITORIO, só `observacoes`/`data` agora
- [x] `app/motorista/avarias/AvariaForm.tsx`: textarea existente
  reetiquetada "Situações a resolver (uma por linha)" — mesma UX de
  escrever tudo de uma vez, dividida em `itens` no submit; novo textarea
  "Observações (opcional)"; lista de pendentes do veículo passa a
  checklist com checkboxes toggleáveis (chama o novo endpoint)
- [x] `components/AvariasTabela.tsx` (escritório): coluna "Situações"
  com checkboxes por item (toggle individual, sem `router.refresh()`
  completo); removido o botão único "Marcar resolvida" (estado 100%
  derivado dos itens); observações mostradas por baixo da lista
- [x] `mailtoAvaria`/`mailtoPedido` (site, 2 sítios): corpo do email
  passa a listar itens com `[x]`/`[ ]` + observações
- [x] App Android (`app-motorista-android`, mesmo padrão espelhado):
  `lib/types.ts` (`ItemAvaria`, `Avaria.itens/observacoes`,
  `NovaAvariaPayload.itens[]`), `lib/api.ts`
  (`atualizarItemAvaria`), `screens/Avarias.tsx` (mesmas mudanças do
  `AvariaForm.tsx`)
- [x] `tsc --noEmit` e `next build` limpos (site); `npm run build` limpo
  (Android)
- [x] Testado ponta a ponta com sessão forjada por HMAC: `POST`
  `itens[]`+`observacoes`; `PATCH .../itens/:itemId` como MOTORISTA → 200
  (antes seria 403); `PATCH /api/avarias/:id` com `observacoes` como
  MOTORISTA → 403, como ESCRITORIO → 200; `resolvida` confirmado a
  passar a `true` sozinho ao resolver o último item; `DELETE` só
  ESCRITORIO. Dados de teste apagados, avaria real id 7 preservada
- [x] Screenshots Playwright confirmam a checklist real (6 itens de
  Ricardo) a aparecer corretamente nos dois lados (motorista e
  escritório)
- [x] Novo `.apk` assinado gerado em
  `app-motorista-android/android/app/build/outputs/apk/release/`
- [ ] **Ação do utilizador**: reinstalar o `.apk` novo no telemóvel do
  motorista

## 🚪 Ícone de "Sair" em falta na app Motorista Android (2026-08-19)

Reportado pelo Ricardo: a app Motorista Android não tinha o ícone junto ao
botão "Sair" que a Administração já tem (`LogOut` do `lucide-react`, ao
lado do texto — ver `app/motorista/layout.tsx`/`app/escritorio/layout.tsx`
no site). Confirma o que já estava documentado: a Administração é WebView
direto ao site (ganha tudo automaticamente), a Motorista tem bundle
próprio (`app-motorista-android/src/App.tsx`) que não herda alterações do
site — precisa de porte manual + rebuild do `.apk` (ver
`android_apps_status` na memória).

- [x] `app-motorista-android/package.json`: `npm install lucide-react`
  (não estava listado como dependência; site usa `^1.25.0`, instalado
  `^1.33.0`)
- [x] `app-motorista-android/src/App.tsx`: botão "Sair" ganha `<LogOut
  size={16} strokeWidth={2} />` antes do texto, igual ao site
- [x] `npm run build` (tsc -b && vite build) limpo, `npx cap sync
  android`, `./gradlew assembleRelease` — novo `app-release.apk` gerado
  em `android/app/build/outputs/apk/release/` (assinado com o keystore
  existente)
- [ ] **Ação do utilizador**: reinstalar (sideload) o novo `.apk` no
  telemóvel do motorista para o ícone aparecer — a Play Protect vai
  avisar, é esperado (app fora da Play Store)

## 📱 2 apps Android (Motorista / Administração) — plano (2026-08-06)

Pedido do Ricardo: transformar isto em 2 apps Android separadas — uma para
motoristas, outra para administração. Decisões já tomadas com o Ricardo:
**distribuição por APK direto** (sideload, sem Play Store) e **registo de
paragens offline** para o motorista (zonas sem sinal nas rotas). Ainda por
implementar — isto é só o plano, nada foi codificado.

### Decisão de arquitetura
- **Capacitor** (não React Native/Expo): embrulha a UI web existente numa
  shell nativa Android, reaproveita ~90% do código React/Tailwind já feito,
  ganha acesso a SQLite/rede/storage nativos só onde é preciso. Reescrever
  tudo em React Native seria muito mais esforço sem benefício aqui (não há
  UI nativa exótica a precisar).
- **App Administração**: sem necessidade offline → shell Capacitor a
  apontar para o `/escritorio` já hospedado no Vercel (WebView remoto,
  como um browser dedicado com ícone próprio). Praticamente nenhuma
  alteração ao código atual.
- **App Motorista**: PRECISA de offline para "Registar paragem" → não pode
  ser só um WebView remoto (se não há rede, nem a página carrega). Vai ser
  um cliente leve novo (Vite+React), com os ecrãs embutidos no `.apk`
  (bundle local), que fala com a mesma API do Vercel e guarda dados em
  SQLite local quando offline.
- **Autenticação**: cookie httpOnly atual não é fiável entre origens
  diferentes (app em `capacitor://localhost` a chamar a API em
  `...vercel.app`) nem funciona offline. As apps passam a autenticar por
  **token** (login devolve um token assinado, guardado em storage seguro
  do telemóvel, enviado como `Authorization: Bearer` em cada pedido) — o
  site continua a usar cookie normalmente, sem alteração.

### Fase 0 — Pré-requisitos e backend partilhado
- [x] Instalar toolchain Android nesta máquina (2026-08-11): JDK 21
  (Temurin, via winget — **JDK 17 não chega**, Capacitor 8.x/AGP atual
  exige 21), Android SDK command-line tools em `C:\Android\sdk`
  (`ANDROID_HOME`/`ANDROID_SDK_ROOT` persistidos), platform-tools,
  `platforms;android-35`, `build-tools;35.0.0`, licenças aceites. Ver
  gotchas em `tasks/lessons.md` (2026-08-11): `local.properties` tem de
  usar `/`, não `\`, no `sdk.dir`.
- [x] `lib/session.ts`/API: token assinado no login + CORS (2026-08-12,
  plano `humble-fluttering-tide.md`). O "token" é o mesmo valor assinado
  já usado na cookie (`createSessionValue`/`readSessionValue`,
  `lib/auth.ts`) — sem formato novo, sem dependência nova, só outro
  transporte. `getSessaoInfo()` (`lib/session.ts`) passa a aceitar
  `Authorization: Bearer <token>` além da cookie, ponto único usado por
  `getSessao()`/`getMotoristaId()` em toda a API (29 ficheiros) — nenhuma
  rota individual foi tocada. `POST /api/auth/login` devolve `token` no
  JSON ao lado de `ok`/`destino` (cookie continua a ser definida na
  mesma, browser ignora o campo novo). `middleware.ts` ganhou CORS para
  `/api/*` (preflight `OPTIONS` + cabeçalhos na resposta), origens
  permitidas por env var nova `APP_ORIGINS_PERMITIDAS` (default cobre as
  origens típicas de uma WebView Capacitor — ajustável sem deploy quando a
  app Motorista existir e a origem real for conhecida). Lógica de páginas
  (`/login`, `/escritorio`, `/motorista`) 100% inalterada — só o CORS de
  `/api/*` é código novo.
  - **Trade-off aceite conscientemente**: o token não expira sozinho (só
    o `AUTH_SECRET` global o invalida, tal como já acontecia com o valor
    da cookie) — para um motorista offline é a UX pretendida (não
    reautenticar sempre que a rede volta); não há revogação individual.
  - Testado de ponta a ponta contra o servidor local (`curl`): login
    devolve `token`; Bearer válido sem cookie nenhuma → 200; Bearer com
    assinatura errada → 403; `OPTIONS` com origem permitida → CORS
    refletido; `OPTIONS` com origem fora da lista → sem cabeçalhos CORS;
    cookie antiga continua 200 (compatibilidade); páginas
    `/escritorio`/`/login` com e sem sessão continuam com o mesmo
    comportamento de sempre
  - Fora de âmbito (fica para quando a app Motorista for construída):
    nenhum código da app em si, nenhum endpoint de logout novo, ajustar a
    allowlist ao valor real
- [x] Keystore de assinatura Android gerado (2026-08-11):
  `app-administracao-android\release-key.jks` (RSA 2048, validade
  ~27 anos, alias `logisticaadmin`), password aleatória forte guardada em
  `android\keystore.properties` (gitignored, nunca commitado).
  `android\app\build.gradle` lê esse ficheiro e assina o build de release
  automaticamente se existir. **⚠️ Ação do Ricardo por fazer: copiar
  `release-key.jks` + a password de `keystore.properties` para um local
  seguro com backup (password manager, cloud privada) — perder qualquer
  um dos dois impede atualizar esta app no futuro.**

### Fase 1 — App Administração (mais simples, sem offline)
- [x] Novo projeto Capacitor criado em pasta irmã (fora do
  `App-logistica-Ricardo`, a pedido do Ricardo):
  `c:\Users\Ricardo\Desktop\app_logistica\app-administracao-android\`.
  `capacitor.config.json` (não `.ts` — falhava a carregar neste ambiente,
  ver lições) com `server.url` = `https://app-logistica-olive.vercel.app/escritorio`,
  appId `com.ricardosilva.logisticaadmin` (fácil de trocar, é só sideload).
  Nome da app decidido com o Ricardo (2026-08-11): **"RsRota"** — a app
  Administração chama-se "RsRota — Administração" (a futura app do
  motorista deve seguir o mesmo padrão: "RsRota — Motorista")
- [x] Build de **debug** gerado com sucesso —
  `android\app\build\outputs\apk\debug\app-debug.apk` (4,1 MB). Confirma
  todo o toolchain (JDK 21 + SDK + Gradle) a funcionar de ponta a ponta
- [x] Ícone + splash screen com o logo do camião fornecido pelo Ricardo
  (`resources/icon.png`/`splash.png`, recortado só a parte central e
  limpo dos cantos do fundo de rua desfocado). Gerados via
  `@capacitor/assets` para todas as densidades Android (launcher
  adaptativo + splash claro/escuro). Build de debug repetido, confirma
  que ficou tudo integrado corretamente
- [x] Build de **release** assinado gerado e verificado —
  `android\app\build\outputs\apk\release\app-release.apk` (8,4 MB),
  assinatura confirmada por `apksigner verify --print-certs`
  (CN=Ricardo Silva, SHA-256 do certificado registado no commit)
- [x] Sessão (cookie) confirmada a persistir entre aberturas da app —
  validado indiretamente: foi exatamente essa persistência que expôs o
  bug de 404 em `/escritorio` (corrigido em 2026-08-11, ver lições), o
  que só acontece com sessão já ativa ao reabrir a app
- [x] `app-release.apk` instalado num telemóvel Android real pelo
  Ricardo; login + navegação completa validados ao longo de várias
  sessões reais (dashboard, rotas, detalhe de rota, motoristas,
  cargas/planta de carga, parâmetros) — **Fase 1 concluída** ✅.
  Como a app é um WebView remoto para `/escritorio` (não tem nada
  embutido no `.apk`), todas as correções e o rebranding RsRota feitos
  hoje (menu mobile, ícone Sair, tabelas, bug dos pneus, "RsRota" no
  login/cabeçalho) já se aplicam à app instalada sem precisar de novo
  `.apk` — só um fecho completo + reabertura (ou limpar cache) para
  apanhar a versão nova

### Fase 2, Entrega 1 — App Motorista online (2026-08-12) ✅
Plano completo: `C:\Users\Ricardo\.claude\plans\humble-fluttering-tide.md`.
Decisão combinada com o Ricardo: construir primeiro a app completa só em
modo **online** (exige rede sempre, tal como o site), e deixar o
SQLite/fila offline para a Entrega 2 — a app não precisou de ser
reescrita, o offline entra por cima desta mesma base.

- [x] Backend (`App-logistica-Ricardo`): novo `GET
  /api/motorista/dados-registo` (zonas, veículos ativos sem custos,
  clientes, rotas recentes, subconjunto de Parametros — tudo o que
  `app/motorista/registo/page.tsx` já carregava server-side, numa só
  chamada); `GET /api/paragens` sem `?idRota=` deixou de dar 403 ao
  motorista — passa a devolver todas as suas próprias paragens (só
  motorista vê as próprias; ramo `?idRota=` inalterado). Testado com
  `curl` + Bearer token forjado (mesmo HMAC local)
- [x] Novo projeto irmão `c:\Users\Ricardo\Desktop\app_logistica\app-motorista-android\`
  — Vite + React 19 + TypeScript + Tailwind (mesma paleta/classes
  utilitárias do site: `.card`/`.btn`/`.input`/cor `brand`).
  `@capacitor/preferences` guarda o token Bearer (chave
  `CapacitorStorage.rsrota_token`). `webDir: "dist"` — bundle **local**
  embutido no `.apk`, ao contrário da Administração (que usa
  `server.url` remoto)
- [x] Em dev, `vite.config.ts` tem um proxy `/api` → API real (evita CORS
  sem mexer na allowlist de produção); `VITE_API_BASE` vazio em dev,
  `.env.production` aponta para `https://app-logistica-olive.vercel.app`
  no build — a app empacotada fala diretamente com a Vercel
- [x] 3 ecrãs portados campo a campo da versão web (não é redesenho):
  Login (só perfil motorista), Registar (avisos de capacidade/zona/
  inspeção do veículo, notas "já introduzido nesta rota", paletes/VAZIO,
  "Continuar rota"), Histórico (agrupado por rota, modal Corrigir/Apagar)
- [x] **Testado a sério contra a API real de produção** (Playwright a
  controlar o Chrome já instalado na máquina, sessão injetada via
  `localStorage` para não depender do PIN real): ecrã de login (+ erro
  com PIN errado), Registar carregou dados reais (2 veículos, 11 zonas,
  89 clientes), submissão de uma paragem de teste criou mesmo a rota
  (`RIC-TESTE-UI-APAGAR`), Histórico mostrou-a corretamente agrupada,
  modal Corrigir abriu com dados reais (incl. campo "Nº de paletes"
  condicional). Paragem de teste apagada a seguir (`DELETE
  /api/paragens/205`) — produção fica como estava
- [x] Capacitor Android configurado: `appId
  com.ricardosilva.logisticamotorista`, ícone/splash reaproveitados da
  Administração por agora (trocar se houver logo próprio do motorista).
  **Novo keystore** (`release-key.jks`, RSA 2048, alias
  `logisticamotorista`, password própria em `android/keystore.properties`,
  gitignored) — não pode reutilizar o da Administração (appId diferente)
- [x] Build de **debug** (`app-debug.apk`, 14 MB) e de **release**
  assinado (`app-release.apk`, 8,5 MB) gerados com sucesso; assinatura
  confirmada por `apksigner verify --print-certs` (CN=Ricardo Silva,
  mesma organização/alias do keystore novo)
- [x] **4º ecrã: "Perfil" — motorista muda o seu próprio PIN** (pedido
  do Ricardo, 2026-08-12, ao rever a entrega: "falta a opção de alterar
  o PIN do perfil do motorista"). `PATCH /api/auth/pin` já existia
  (self-service do escritório) mas estava trancado a `ESCRITORIO` — a
  lógica já era genérica (muda o PIN do próprio `sessao.id`), só faltou
  deixar de bloquear `MOTORISTA`. Componente
  `AlterarPinEscritorio.tsx` generalizado para
  `components/AlterarPinProprio.tsx`, partilhado por Parâmetros
  (escritório) e pela nova página `/motorista/perfil` (site) + novo
  separador "Perfil" na app Capacitor. Testado de ponta a ponta (PIN
  atual errado → 401, sem sessão → 403, ciclo mudar→confirmar
  login→repor original, nos dois lados — site e app)
- [x] De caminho, corrigido um **overflow horizontal real** descoberto ao
  testar a 320px: com 3 separadores + nome + "Sair" na mesma linha, o
  botão Sair ficava cortado (inacessível) em telemóveis mais estreitos.
  Cabeçalho passa a 2 linhas (nome+Sair em cima, separadores em baixo)
  no site e na app — testado a 320px/360px nos dois, sem overflow.
  Aplicado proativamente na app antes de aparecer o mesmo bug lá
- [ ] **⚠️ Ação do Ricardo**: copiar `release-key.jks` +
  a password de `keystore.properties` (novo projeto
  `app-motorista-android`) para um local seguro com backup — mesmo
  cuidado já pedido para a Administração, keystore diferente desta vez
- [ ] **Ação do Ricardo**: instalar o `app-release.apk` num telemóvel
  Android real, fazer login com o PIN real e validar o fluxo completo
  (registar paragem numa rota nova e a continuar, ver os avisos, corrigir
  no Histórico) — só falta esta validação manual para a Entrega 1 estar
  fechada
- [ ] (Opcional) Logo/ícone próprio para a app Motorista, se não quiseres
  reaproveitar o camião da Administração

### Fase 2, Entrega 2 — sincronização offline (2026-09-08) ✅ código, ⚠️ falta teste real

Plano: `C:\Users\Ricardo\.claude\plans\elegant-discovering-tiger.md`. **Mudança de
arquitetura face a este plano original**: em vez de `@capacitor-community/sqlite`,
usa `@capacitor/preferences` (já usado para o token, `src/lib/auth.ts`) a guardar
JSON — a fila nunca passa de uma dúzia de entradas, não precisa de SQL, e evita o
plugin nativo pesado + o web-shim (`jeep-sqlite`) só para testar no browser.
Confirmado com o Ricardo antes de implementar.

- [x] `src/lib/fila.ts` (novo): fila de paragens por sincronizar + cache de
  `DadosRegisto` + cache do resumo de cada rota (fallbacks quando não há rede)
- [x] `src/lib/sync.ts` (novo): `sincronizar()` — envia a fila por ordem
  (sequencial); erro de rede para o loop sem descartar nada; erro do
  servidor (`ErroApi`) marca o item e para nesse ponto (não salta à frente)
- [x] Regra combinada em agosto respeitada: **iniciar rota NOVA exige rede**
  (bloqueado com mensagem clara); **continuar rota já ativa funciona
  offline** (`Registar.tsx::submeter` — erro de rede + `idRotaAtiva`
  preenchido → `adicionarAFila`, UI otimista igual à do caminho online)
- [x] `App.tsx`: `Network.addListener("networkStatusChange", ...)`
  sincroniza sozinho ao voltar a rede. `Registar.tsx`/`Historico.tsx`: botão
  manual "Sincronizar agora" + indicador "N por sincronizar"
- [x] Notas "já introduzido" (`carregarResumoRota`) juntam os itens da fila
  local por cima da API/cache — não duplicam noites/alimentação/zona mesmo
  offline. `Historico.tsx` mostra os pendentes na mesma lista da rota, com
  badge "por sincronizar" em vez do botão Corrigir (editar um item ainda em
  fila fica fora de âmbito, decisão de simplicidade)
- [x] `npm install @capacitor/network`; `tsc -b`, `npm run build`, `oxlint`
  (só os 3 avisos pré-existentes) limpos
- [ ] **Não testável por mim**: modo avião num telemóvel real, `npx cap sync
  android && gradlew assembleRelease` + o teste combinado de agosto (3
  paragens offline → sincronizar → conferir no escritório, sem duplicados
  nem perdas) — ação do Ricardo

### Fase 3 — Distribuição
- [ ] Build de release assinado de cada app
- [ ] Instalar e validar em pelo menos 1 telemóvel Android real por perfil
- [ ] Processo de distribuição: partilhar o `.apk` (link/drive/WhatsApp) a
  cada atualização; lembrar de ativar "Fontes desconhecidas" no Android
  (aviso normal do Play Protect para apps fora da Play Store)

### Nota de esforço
Isto não é uma tarde de trabalho — a app Administração é rápida (poucos
dias), mas a app Motorista com sincronização offline é a parte grande do
projeto (fila local, resolução da regra rota nova vs continuar rota,
testes de sincronização em cenários reais). Vale a pena fazer em 2
entregas separadas (Administração primeiro, valida o processo de build/
assinatura/distribuição; Motorista depois).

### Manutenção — ícones de despesas no Histórico (2026-08-16)
- [x] `components/DespesasIcones.tsx` (site) criado e reaproveitado em
  `app/escritorio/rotas/[idRota]/page.tsx` (tabela Paragens) e
  `app/motorista/historico/HistoricoMotorista.tsx` (lista "As minhas
  rotas") — ícones ⛽🇪🇸 🌙 🍽️ ⏱️ 🛣️ junto ao nome do cliente quando essa
  paragem tem combustível Espanha/noites/alimentação/horas extra/
  portagens extra preenchidos, com tooltip a detalhar os valores.
- [x] Portado à mão para `app-motorista-android/src/components/
  DespesasIcones.tsx` (não pode importar do site — bundle local próprio)
  e aplicado em `src/screens/Historico.tsx`. `fmtNum2` adicionado a
  `src/lib/format.ts` (só tinha `fmtNum`/`fmtEuro`/`fmtData`).
- [x] `npx cap sync android` + `gradlew assembleRelease` corridos de
  novo — novo `app-release.apk` assinado (mesmo certificado CN=Ricardo
  Silva, OU=RsRota), pronto a instalar por cima da versão anterior.
- **Lembrete**: a app Motorista tem bundle local embutido no `.apk` (ao
  contrário da Administração, que é WebView remoto) — qualquer alteração
  a ecrãs partilhados (Histórico/Registar/Perfil) tem de ser portada à
  mão para `app-motorista-android/src/` E o `.apk` tem de ser
  regenerado/reinstalado; só código do `/escritorio` (Administração)
  atualiza sozinho ao reabrir a app.

## 🌙 Resumo da rota em curso — evitar sobreposição de noites/alimentação (2026-08-06)

Pedido do Ricardo: o motorista regista uma paragem de cada vez (mesma
`idRota`) e "Noites fora"/"Alimentação" são campos por paragem — a meio de
uma rota com vários clientes já não sabe o que introduziu, arriscando
duplicar ou esquecer. Abordagem escolhida: **não mexer no schema** (noites/
alimentação continuam por paragem), só tornar visível o que já foi
registado nesta rota, em tempo real.

- [x] `app/api/paragens/route.ts` (GET): motorista passa a poder consultar
  as SUAS PRÓPRIAS paragens de uma rota (`?idRota=`), sem alargar acesso a
  outras rotas/motoristas (401 sem sessão, 403 para motorista sem `idRota`;
  escritório mantém a listagem completa inalterada)
- [x] `app/motorista/registo/page.tsx`: quando `searchParams.idRota` vier
  preenchido (fluxo "Continuar rota" a partir do Histórico), pré-carrega as
  paragens já existentes dessa rota e passa como prop
- [x] `app/motorista/registo/RegistoForm.tsx`:
  - novo estado `paragensRota` (paragens já submetidas nesta rota); ao
    submeter, acrescenta a paragem devolvida pelo servidor (sem pedido
    extra); "Nova rota" limpa a lista
  - nota inline por baixo de "Noites fora": "Já foi introduzida 1 noite
    nesta rota." / "Já foram introduzidas N noites nesta rota."
  - nota inline por baixo de "Alimentação": lista os valores individuais já
    lançados — "Já foram introduzidos: 12€, 8€ e 5€ nesta rota."
- [x] `app/motorista/historico/HistoricoMotorista.tsx`: cabeçalho de cada
  rota passa a mostrar também Σ noites e Σ alimentação ao lado do nº de
  paragens
- [x] `tsc --noEmit` limpo, `next build` OK, 107 testes verdes (sem tocar no
  motor de cálculo). Testado `GET /api/paragens` sem sessão → 401 (dev
  server local, sem criar dados de teste na BD)
- [x] Mesmo padrão estendido a "Portagens Extra (€)" (lista os valores já
  lançados) e "Zona Portagem" (lista as zonas já usadas) — só no formulário
  de registo, não no Histórico
- [x] `components/ParagemEditor.tsx` ganhou `mostrarDetalheEuroNoites`
  (default `true`); `HistoricoMotorista.tsx` passa `false` — o motorista
  deixa de ver "N × 70 € = X €" ao corrigir uma paragem no Histórico.
  Escritório (`ParagemAcoes.tsx`, sem a prop) mantém o detalhe em euros,
  como já era o comportamento pedido em 2026-07-14
- [x] `tsc --noEmit` limpo, `next build` OK, 107 testes verdes
- [ ] **Verificação manual (utilizador)**: registar 2 paragens na mesma rota
  com noites/alimentação/portagens extra/zona e confirmar que as notas por
  baixo dos campos aparecem e somam certo; "Continuar rota" a partir do
  Histórico pré-carrega essas notas; confirmar que o Histórico mostra os
  totais por rota E que "Corrigir" já não mostra o valor em euros da noite;
  escritório continua a ver tudo normalmente (incl. o detalhe em euros ao
  editar)

## 🧾 Orçamentos — cliente por dropdown, zona por lista, adicionais (2026-08-06)

Plano: `C:\Users\Ricardo\.claude\plans\humble-cuddling-stardust.md`. 3 pedidos
do Ricardo ao formulário de orçamentos.

- [x] Cliente: campo passa de input+datalist para `<select>` real (lista de
  clientes + opção "➕ Novo cliente…" que revela um input de texto livre com
  botão "← Existente" para voltar) — `OrcamentoForm.tsx`
- [x] Zona de portagem por linha: sugestões da `TabelaPortagem` (mesmo padrão
  datalist do `ParagemEditor.tsx`), carregada nas 2 páginas
  (`orcamentos/novo`, `orcamentos/[id]`)
- [x] Adicionais por linha (noites do motorista + alimentação): novo em
  orçamentos — o motor (`calcularParagem`) não os incluía no custo por
  paragem (só no total da rota, `perRoute.ts`). `estimarLinha` agora soma
  `noitesFora × valorNoite (snapshot) + alimentação` a `custoEstimado`;
  campos opcionais em `LinhaDevis`/`EstimarLinhaInput` (retrocompatível com
  orçamentos antigos sem estes campos no Json)
- [x] `lib/validacao.ts` (`linhaDevisSchema`/`estimarDevisSchema`),
  `app/api/devis/estimar/route.ts`, `DetalheLinha.tsx` (painel interno)
  atualizados
- [x] 6 testes novos (107 no total), `tsc --noEmit` limpo, `next build` OK
- [ ] **Verificação manual (utilizador)**: criar orçamento — escolher cliente
  existente no dropdown (autofill) e "Novo cliente" (texto livre); zona de
  portagem sugere as configuradas em Parâmetros; preencher noites/alimentação
  numa linha, "Calcular" e confirmar o acréscimo no custo + painel de
  detalhe; guardar e reabrir para confirmar persistência

## ⛽ Consumo de combustível reflete o peso real a bordo em cada troço (2026-08-06)

Plano: `C:\Users\Ricardo\.claude\plans\eventual-fluttering-crane.md`. O
Ricardo notou que, numa rota com vários clientes, o camião vai ficando mais
leve a cada entrega — mas o motor calculava o consumo de cada troço só com
o peso próprio desse cliente, ignorando o resto da carga ainda a bordo.
Confirmado com dados reais (rota `RIC-A22`).

- [x] `lib/calc/types.ts` — `ParagemInput.pesoEmTransito?: number` (opcional,
  sem impacto em nenhum literal existente)
- [x] `lib/calc/perRoute.ts` — `pesosEmTransito()`: agrupa paragens por
  `idRota`+`tipoViagem`+dia, ordena por `kmInicial`, acumula peso a
  descer/subir por troço; injetado em `calcularRota` antes de
  `calcularParagem`. Grupos de 1 paragem (maioria das rotas, incl. HILP01)
  ficam inalterados.
- [x] `lib/calc/perStop.ts` — só o `consumoL100` passa a usar
  `pesoEmTransito ?? peso`; `coeficienteCarga`/`precoPorKg` e o rateio
  entre clientes (`coeficienteReal` em `perRoute.ts`) continuam a usar o
  peso próprio de cada paragem — confirmado com o Ricardo (cada cliente
  paga pelo que é dele; só o custo total da rota fica mais exato).
  Aplica-se também a rotas antigas (sem peso congelado em snapshot,
  confirmado com o Ricardo).
- [x] 15 testes novos (`pesosEmTransito` isolada + `calcularRota` com
  números exatos: consumo 38/28/25 L/100km em vez de 31/25/25 para o mesmo
  cenário) — 104 testes verdes no total, `tsc --noEmit` limpo, `next
  build` OK
- [x] Validado à mão contra a rota real `RIC-A22` (script `tsx` temporário):
  consumo por troço passa a descer 35→28→28→28→25→25→25→25 L/100km ao
  longo do dia 2026-07-09, e os troços do dia seguinte (idRota reutilizado)
  ficam corretamente isolados
- [ ] **Nota para o Ricardo**: os custos/lucros de rotas antigas com mais de
  1 cliente na mesma direção/dia vão mostrar valores ligeiramente
  diferentes a partir de agora (mais exatos) — o km e o peso registados
  não mudam, só a fórmula do consumo

## 📦 Cargas — empacotamento de paletes por veículo/reboque (2026-08-04)

Plano: `C:\Users\Ricardo\.claude\plans\eventual-fluttering-crane.md`. Nova
funcionalidade operacional (independente de Orçamentos/Cobranças): o
utilizador cria um "carregamento" para um veículo e vai adicionando pedidos
(cliente + tipo de palete + quantidade) à medida que os clientes telefonam;
o motor de empacotamento (simulação geométrica por "prateleiras", testando
as 2 orientações de cada palete) diz quanto espaço já está ocupado e sugere
anexar um reboque do catálogo quando não há mais espaço.

- [x] Schema: `Veiculo` +`caixaComprimentoMm`/`caixaLarguraMm` (mm, nullable
  — opt-in); modelos novos `TipoPalete` (catálogo editável, não lista fixa),
  `Reboque` (catálogo independente, anexado por carregamento, não fixo ao
  veículo), `Carregamento` (sessão de carga: veículo + reboque opcional +
  estado ABERTO/FECHADO), `PedidoPalete` (linha: cliente + tipo + qtd +
  ordem de chegada) — `db push` feito no Neon
- [x] `lib/calc/paletePacking.ts` (puro, sem DB) — empacotamento **online por
  ordem de chegada** (nunca reordena por tamanho): prateleiras que testam as
  2 orientações da palete, heurística "mais paletes lado a lado" ao abrir
  prateleira nova (testado à mão contra o exemplo do próprio Ricardo — a
  heurística ingénua "menor profundidade" só dava 6 das 10 paletes
  1300x1100 quando cabem 10). `estimarQuantosCabem()` reaproveita
  `empacotar()` com unidades sintéticas apensas, sem duplicar o algoritmo.
  13 testes novos (93 no total)
- [x] `lib/carregamento-service.ts` — `carregarCarregamento()` monta as
  caixas (veículo + reboque se anexado), corre o packing, e sugere reboques
  do catálogo ordenados por quantas das paletes em falta cada um resolveria
- [x] APIs: `tipos-palete`, `reboques`, `carregamentos` (+`/pedidos`,
  `/pedidos/[pedidoId]`) — CRUD `ESCRITORIO`-only, mesmo padrão Zod +
  Prisma do resto do projeto. Um pedido é **sempre gravado**, mesmo sem
  espaço (o compromisso ao telefone já foi feito) — a UI só assinala
  overflow + sugestões de reboque
- [x] Fix obrigatório em `app/api/clientes/agrupar/route.ts`: repontar
  `PedidoPalete.clienteId` das variantes fundidas para o cliente canónico
  antes do `deleteMany` (ver lições 2026-08-04 — primeira FK real a
  `Cliente.id` do projeto)
- [x] Fix de bug real (só apanhado ao testar contra a BD real, não por
  tsc/vitest): catch de `P2003` ao apagar veículo/tipo de palete não
  disparava em Postgres (lança `23001` embrulhado como
  `PrismaClientUnknownRequestError`) — `lib/prisma-errors.ts::ehErroFkRestricao()`
- [x] UI: `/escritorio/cargas` (lista + detalhe com planta SVG por caixa,
  cor por cliente + legenda + texto, nunca só cor), `/escritorio/reboques`
  (catálogo leve), Tipos de Palete dentro de Parâmetros (tabela editável),
  novo item de menu "Cargas"
- [x] 93 testes verdes, `tsc --noEmit` limpo, `next build` OK (52 rotas)
- [x] **Teste manual end-to-end contra a BD real** (não só unitário):
  recriado o exemplo exato do Ricardo — AO-33-PJ 7500×2480mm, Cliente A
  10×1300x1100 (cabem as 10, sem aviso), Cliente B 6×1200x800 (dispara
  aviso, 4 sem espaço, sugestão do reboque 8150×2480mm resolve tudo),
  Cliente C 14×1150x1150 (11 colocadas / 3 sem espaço) — números batem
  exatamente com os testes unitários. Testado também: apagar
  veículo/tipo-palete em uso bloqueado (409 amigável), apagar reboque em
  uso liberta o carregamento (SetNull), remover um pedido liberta espaço,
  fundir clientes com pedidos associados continua a funcionar. Dados de
  teste limpos da BD no fim (os 6 tipos de palete reais do Ricardo ficaram)
- [ ] **Ação do utilizador**: em `/escritorio/veiculos`, preencher a caixa
  (mm) dos veículos reais que vão ser usados em Cargas; em
  `/escritorio/reboques`, registar os reboques reais (com as suas medidas)

## 📊 Ficha de veículo como página + estatísticas (2026-07-18)

Plano: `C:\Users\Ricardo\.claude\plans\dynamic-watching-koala.md`. Clicar num
veículo em `/escritorio/veiculos` deixou de abrir modal — passa a navegar
para `/escritorio/veiculos/[id]`, uma página normal com estatísticas (cargas
efetuadas = paragens com kg carregados > 0, clientes atendidos, kg
transportados por mês do ano corrente em gráfico) + o formulário de edição
(antes no modal) + acesso a Manutenções.

- [x] `lib/veiculos-service.ts` — `carregarEstatisticasVeiculo(veiculoId)`,
  agregação direta sobre `Paragem` (não precisa do motor de cálculo, ao
  contrário do custo por cliente que é rateado por rota)
- [x] `lib/veiculo-form.ts` + `components/VeiculoCamposForm.tsx` — tipos e
  UI de campos/pneus extraídos de `VeiculosManager.tsx` para serem
  partilhados entre o modal "Novo veículo" e a página de edição (evita
  duplicar ~150 linhas)
- [x] `components/VeiculoGrafico.tsx` — gráfico mensal de kg (Recharts,
  mesmo padrão do `ClienteGrafico.tsx`), 12 meses fixos (Jan–Dez, 0 nos
  meses sem carga)
- [x] `app/escritorio/veiculos/ManutencoesModal.tsx` — extraído de
  `VeiculosManager.tsx`, props desacopladas de `VeiculoBD` (só
  `veiculoId`/`veiculoNome`/`manutencoesIniciais`)
- [x] `app/escritorio/veiculos/[id]/page.tsx` + `VeiculoDetalheEditor.tsx`
  — página nova (padrão de `rotas/[idRota]/page.tsx`: Server Component +
  `notFound()`), `VeiculosManager.tsx` simplificado (cartão volta a ser um
  `<Link>` simples, sem `stopPropagation`)
- [x] 80 testes verdes, `tsc --noEmit` limpo, `next build` OK
- [x] Smoke test: `/escritorio/veiculos/[id]` responde 200 (veículo real) e
  404 (`notFound`, id inexistente); números da página (35 cargas, 73
  clientes, 173 546 kg) confirmados contra query Prisma direta

## 🔧 Manutenções por veículo (2026-07-18)

Plano: `C:\Users\Ricardo\.claude\plans\dynamic-watching-koala.md`. Botão
"Manutenções" no cartão de cada veículo em `/escritorio/veiculos`, abre modal
com descrição/data/valor/dias por reparação; valor e dias ficam opcionais
(podem ser preenchidos mais tarde). Totais (dias parado, custo total)
recalculados ao vivo a partir das linhas.

- [x] Schema: novo modelo `Manutencao` (`veiculoId`, `descricao`, `data`,
  `valor?`, `dias?`) — `db push` feito no Neon
- [x] Cada manutenção é uma linha independente com CRUD próprio (POST/PATCH/
  DELETE por id), **não** o padrão "apagar tudo + recriar" usado nos Pneus —
  decisão deliberada para evitar a classe de bug de duplicados corrigida nos
  parâmetros (ver lições)
- [x] APIs: `POST /api/veiculos/[id]/manutencoes`,
  `PATCH`/`DELETE /api/manutencoes/[id]`
- [x] UI: `VeiculosManager.tsx` — resumo no cartão + `ManutencoesModal`
  (tabela editável, guarda por campo no `onBlur`, "+ Nova manutenção" cria já
  no servidor)
- [x] 80 testes verdes, `tsc --noEmit` limpo, `next build` OK, smoke test via
  curl contra a BD real (criar → PATCH valor/dias → confirmar totais na
  página → apagar, sem deixar resíduo)
- [ ] **Verificação manual (utilizador)**: abrir `/escritorio/veiculos`,
  clicar "Manutenções" num veículo, adicionar linhas e confirmar os totais

## 📋 Melhorias à lista/detalhe de Rotas (2026-07-19)

- [x] `/escritorio/rotas`: por defeito (sem clicar em nenhum cabeçalho / após
  "Limpar") mostra a rota mais recente primeiro (data decrescente). Clicar
  num cabeçalho continua a funcionar como antes (1º clique ascendente).
- [x] `/escritorio/rotas/[idRota]`: novos cartões "Total KG Carregados" /
  "Total KG Descarregados" (soma de todas as paragens da rota).
- [x] `/escritorio/rotas/[idRota]`: a tabela "Paragens" (e a de "Rateio por
  cliente", que deriva da mesma ordem) passa a seguir a sequência real da
  rota — ordenada por `kmInicial` em vez de por data (`carregarRota()` em
  `lib/rotas-service.ts`). Só afeta a página de detalhe de uma rota; a
  listagem/exportação continuam ordenadas por data (não pedido, evita
  efeitos colaterais nas agregações por cliente/exportação Excel).
- [x] 80 testes verdes (motor de cálculo não mudou), `tsc --noEmit` limpo,
  `next build` OK

## 🗑️ Remoção do tipo de veículo "LEVE" (2026-07-17)

Confirmado com o Ricardo que não faz sentido no negócio — removido por
completo (0 paragens/orçamentos históricos usavam-no, confirmado por query
antes de remover). Deixou de existir em `TIPOS_VEICULO`
(`lib/validacao.ts`), no motor de cálculo (`coeficienteCarga`/
`coeficienteReal` em `lib/calc/perStop.ts`), no mapeamento de portagens
TollGuru (`lib/portagens.ts`) e no aviso de excesso de capacidade
(`RegistoForm.tsx`). Como consequência, o "coeficiente de carga" deixou de
precisar do caso especial `"Volume"` (só existia para LEVE) — simplificado
de volta para `number` puro em `ParagemCalc`/`DetalheEstimativa` e nos 3
sítios que o mostravam (`rotas/[idRota]/page.tsx`, `DetalheLinha.tsx`,
`api/exportar/route.ts`).
- [x] 80 testes verdes, `tsc --noEmit` limpo, `next build` OK

## 🔧 Correção da tarifação por paletes (2026-07-17)

Depois de revisitar o requisito com o Ricardo, 2 correções à feature de
2026-07-14 (ver secção abaixo):

1. **Combustível das paletes = sempre como vazio**, agora garantido
   explicitamente no motor (`lib/calc/perStop.ts`: `consumoPorCarga(ehPalete
   ? 0 : peso, tabela)`), em vez de depender por coincidência de o peso das
   paletes calhar sempre no 1º escalão da tabela de consumo. Teste novo
   prova isto com peso residual acima do 1º escalão (12000kg), que sem a
   correção teria dado um consumo diferente do vazio.
2. **O peso deixou de entrar no registo de paletes** — o cliente esclareceu
   que "nem vale a pena colocar o peso, só causa confusão" para este tipo de
   carga (o que importa é só a base/ocupação, nº de paletes). Removida toda
   a lógica de sugestão automática de peso (`pesoMedioPaleteA/B`) e os
   campos de peso ficam escondidos no registo (motorista/escritório) e nos
   orçamentos quando o tipo de veículo é uma palete. `pesoMedioPaleteA/B`
   removidos do schema (`Parametros`), `ParametrosCusto` e de todos os
   formulários — `db push --accept-data-loss` (só a linha de configuração
   singleton, sem dados de negócio).
3. Confirmado (sem alteração de código): cargas mistas na mesma rota — ex.
   10.000kg do Cliente A + 15 paletes leves do Cliente B — já funcionam
   registando 2 paragens separadas na mesma `idRota`, uma por cliente/etapa,
   cada uma com o seu tipo de veículo; o rateio já soma e normaliza
   corretamente (testado em "rateio misto peso + paletes").
- [x] 80 testes verdes, `tsc --noEmit` limpo, `next build` OK

## 🎨 Tarifação por paletes (2026-07-14)

Plano: `C:\Users\Ricardo\.claude\plans\ricardo-silva-ricardosilva2992-gmail-com-adaptive-octopus.md`.
Dois novos serviços de transporte por paletes (1.2×0.8×2.7m ~60kg, 38/camião;
1.2×1×2.7m ~30-120kg, 28/camião) onde o peso não reflete a ocupação real do
camião. Adicionados como novos valores de `tipoVeiculo`
(`PALETE_120X80`/`PALETE_120X100`), com ocupação = nº paletes/capacidade
desse tipo (em vez de peso/capacidade kg), aplicável tanto ao registo de
rotas (rateio entre clientes) como aos orçamentos.

- [x] Schema: `Parametros`/`Veiculo` +capacidadePaleteA/B (+pesoMedioPaleteA/B
  só em `Parametros`), `Paragem` +`nPaletes` — `db push` feito no Neon
- [x] Motor (`lib/calc/perStop.ts`): `coeficienteCarga`/`coeficienteReal()`
  com branches para os 2 tipos de palete; `coeficienteReal()` ganhou um 4º
  parâmetro `nPaletes` **opcional** (default 0) para não quebrar os testes
  existentes; `lib/rotas-service.ts` (`paragemToInput`) atualizado — sem
  isto as rotas já registadas não refletiam a ocupação por paletes
- [x] `lib/calc/orcamento.ts`: `nPaletes` propagado a `estimarLinha`;
  `DetalheEstimativa` mostra `coeficienteCarga`/`nPaletes` no painel interno
  (`DetalheLinha.tsx`, nunca vai ao PDF)
- [x] `lib/validacao.ts`: `TIPOS_VEICULO` +2 valores, `ROTULOS_TIPO_VEICULO`
  para rótulos amigáveis nos selects
- [x] UI: `RegistoForm.tsx` (motorista) e `ParagemEditor.tsx` (escritório)
  ganharam campo "Nº de paletes" condicional, com sugestão automática do
  peso (nº × peso médio) só enquanto o peso não for editado à mão (flag
  "peso tocado"); `VeiculosManager.tsx` ganhou override por veículo;
  `ParametrosForm.tsx` ganhou grupo "Paletes"; `OrcamentoForm.tsx` idem
  (trocada a constante `TIPOS_VEICULO` duplicada pela partilhada)
- [x] Testes novos: `coeficienteCarga`/`coeficienteReal` para os 2 tipos de
  palete, cenário de rateio misto peso+paletes (invariantes Σquota=1,
  Σcusto atribuído=custo total), `estimarLinha` com paletes — 79 testes
  verdes (67 + 12 novos), `tsc --noEmit` limpo, `next build` OK
- [ ] **Ação do utilizador**: configurar em `/escritorio/parametros` (grupo
  "Paletes") os valores reais de capacidade/peso médio se diferentes dos
  defaults (38/28 paletes, 60/75 kg médios)
- [ ] **Verificação manual**: registar uma paragem com `PALETE 120×80`,
  confirmar sugestão de peso e aviso de sobrecarga; ver "Coef. carga" na
  rota do escritório; criar linha de orçamento com paletes e ver o painel
  de detalhe

## 📧 Pedidos do email de Ricardo a Miguel (1/07/2026) (2026-07-14)

Plano: `C:\Users\Ricardo\.claude\plans\ricardo-silva-ricardosilva2992-gmail-com-adaptive-octopus.md`.
Dos 5 pedidos do email, 2 já estavam feitos (portagens automáticas via TollGuru
+ tabela zona, vista de orçamentos por cliente — commit `be252f4`). Implementados
os restantes:

- [x] `components/Calculadora.tsx` — calculadora simples flutuante, montada em
  `app/motorista/layout.tsx` e `app/escritorio/layout.tsx` (disponível em todas
  as páginas de ambas as áreas)
- [x] Motorista: removida a linha "X × Y€ = Z€" do campo "Noites fora" em
  `RegistoForm.tsx` — só mostra o número agora. Backoffice (`ParagemEditor.tsx`)
  mantém o detalhe em euros (fora do âmbito do pedido). `custoNoites`/
  `valorNoite` continuam a alimentar o motor de custo sem alteração.
- [x] Coluna "Coef. carga" na tabela de Paragens em
  `app/escritorio/rotas/[idRota]/page.tsx` — expõe `coeficienteCarga`
  (já calculado em `lib/calc/perStop.ts`, fórmula validada contra a coluna M
  do Excel do Ricardo). Motor de cálculo não mudou, só passou a ser mostrado.
- [ ] **Ação do utilizador**: sincronizar `TabelaPortagem` (Parâmetros) com a
  folha `Tabela_ConsPort` do Excel enviado (Galiza=72.7, Armazém norte=28.65,
  MarTorres3=14.15, VilarFormoso=18.15, Zambujeira=35, AveirasStubal3=11.35,
  MARsesimbra3=22.3, Tecges=8.7, SPortagem=0). UI já existe em
  `/escritorio/parametros` — não precisa de código. ⚠️ Atenção: `portagemTabela`
  não está congelado em snapshot, por isso mudar o valor de uma zona altera
  retroativamente o custo/lucro das rotas antigas que a usaram.
- [x] Sistema de alias de clientes: modelo `ClienteAlias` (schema.prisma,
  `db push` já feito no Neon), `POST /api/clientes/agrupar` (funde variantes →
  nome canónico numa transação: `Paragem`/`Devis`.updateMany + upsert de
  aliases + reconciliação da ficha `Cliente`), `app/api/importar/route.ts`
  passa a normalizar o nome do cliente pelo alias antes de criar as paragens,
  `listarNomesClientes()` em `lib/clientes-service.ts`, UI nova em
  `/escritorio/clientes/agrupar` (`AgruparClientes.tsx`) com link a partir de
  `/escritorio/clientes`. Só toca no campo string `cliente`/`nome` — nunca em
  custo/receita/snapshot/totais (confirmado: `perRoute.ts` agrupa por
  `p.cliente`, juntar variantes na mesma rota só soma linhas no `rateio`).
- [x] `npx tsc --noEmit` limpo, 67 testes Vitest verdes, `next build` OK
  (29 rotas, incluindo as 2 novas: `/escritorio/clientes/agrupar` e
  `/api/clientes/agrupar`)
- [ ] **Verificação manual (utilizador)**: abrir a calculadora em
  `/motorista/registo` e em `/escritorio/dashboard`; registar noites como
  motorista (só vê o número); ver rota no escritório (coluna "Coef. carga"
  bate com o Excel); ir a `/escritorio/clientes/agrupar`, selecionar 2 nomes
  variantes e agrupar — confirmar que o cliente único em `/escritorio/clientes`
  soma o histórico de ambos; reimportar um ficheiro com essa variante e
  confirmar que cai automaticamente no nome canónico

## Fases (concluídas)
- [x] Fase 1–7 — App completa, validada end-to-end (ver histórico abaixo)

## 🆔 ID de rota gerado automaticamente (2026-06-11)

O condutor já não inventa o `idRota`. Ao criar uma rota nova, o servidor gera
`INICIAIS-Cliente` (3 letras do 1.º nome + 2 do apelido + cliente), com sufixo
`2,3,…` se já existir. Rotas multi-dia: o condutor seleciona a rota recente na
lista (mesmo `idRota` reutilizado, nunca regenerado).

- [x] `lib/rota-id.ts` — `iniciais()` (deburr + fallback no codigo) + `gerarIdRota()`
  (unicidade por regex `^base(\d+)?$`)
- [x] `validacao.ts`: `idRota` passa a opcional (vazio => rota nova)
- [x] `app/api/paragens/route.ts`: gera o ID quando ausente (carrega nome/codigo do user)
- [x] `RegistoForm.tsx`: campo de texto -> seletor "rota ativa" (nova rota | continuar
  rota recente); lê o `idRota` devolvido pelo servidor para encadear paragens
- [x] tsc limpo, 47 testes verdes, `next build` OK
- [ ] **Verificação manual (utilizador)**: criar rota nova (ex. cliente "Boto" ->
  ID tipo `RICSI-Boto`), repetir (-> `RICSI-Boto2`), e continuar via lista recente

## 🧾 Orçamentos / devis + envio por email (2026-06-11)

Secção comercial a montante: criar orçamentos no escritório, estimar o preço com o
motor de custos existente (km via OpenRouteService, perfil pesado, ida e volta),
gerar PDF e enviar ao cliente (fluxo "sem servidor": descarrega o PDF + abre o email
pré-preenchido via mailto). NÃO toca no cálculo de rotas/rentabilidade.

- [x] Schema: modelo `Devis` (linhas em Json) — `prisma db push` no Neon (feito)
- [x] `lib/distancia.ts` — OpenRouteService (geocode + directions driving-hgv), resiliente
- [x] `lib/calc/orcamento.ts` (puro) — `estimarLinha`/`totaisDevis`/`kmComRegresso`/
  `proximoNumeroDevis` + 11 testes (63 testes verdes no total)
- [x] `validacao.ts`: schemas devis/linha/estimar
- [x] APIs: `/api/devis` (POST/GET), `/api/devis/[id]` (PATCH/DELETE),
  `/api/devis/[id]/pdf` (@react-pdf), `/api/devis/estimar`
- [x] `lib/pdf/DevisDocument.tsx` (A4) + smoke test (`%PDF-` OK)
- [x] UI: menu "Orçamentos", lista, editor (`OrcamentoForm`), `EnviarOrcamento`,
  `EstadoOrcamentoBadge`, `ApagarOrcamento`
- [x] tsc limpo, build OK, 63 testes verdes
- [x] `ORS_API_KEY` **configurada na Vercel** — confirmado em produção
  (2026-08-11) via `POST /api/devis/estimar` real (Lisboa→Porto):
  `kmAuto: 315` sem aviso, o cálculo automático está mesmo a funcionar
- [ ] **Verificação manual**: criar orçamento (Lisboa→Porto, ida/volta), "Calcular"
  → km ~626 + preço sugerido; "Descarregar PDF" e "Preparar email"
- [ ] (Opcional) Personalizar o cabeçalho da empresa em `lib/pdf/DevisDocument.tsx`
  (constante `EMPRESA`)

### Extras orçamentos (2026-06-11)
- [x] Detalhe interno por linha (DetalheLinha) — decomposição do custo + margem
  aplicada (alerta prejuízo/abaixo do mínimo); NÃO vai no PDF do cliente
- [x] Autocomplete de moradas (ORS `geocode/autocomplete`) — `MoradaInput` +
  `/api/devis/geocode`; origem/destino com sugestões para clicar
- [x] Portagens automáticas de camião via TollGuru (`lib/portagens.ts`) — substitui a
  tabela por zona quando disponível (override em `estimarLinha`), com fallback gracioso
- [x] Vista de orçamentos por cliente na ficha de Clientes (+ "Novo orçamento" pré-preenchido)
- [x] 67 testes verdes, tsc limpo, build OK
- [ ] **Ação do utilizador**: `TOLLGURU_API_KEY` **confirmado NÃO configurada na
  Vercel** (2026-08-11, testado em produção real: `avisoPortagem: "TOLLGURU_API_KEY
  não configurada."`) — as portagens automáticas nunca chegaram a ligar-se; a app
  usa sempre a tabela por zona (fallback), o que já é o comportamento atual usado
  em produção. Criar chave grátis em tollguru.com e configurar na Vercel só se
  quiseres portagens calculadas automaticamente por rota em vez da tabela fixa
- [x] **Bug real encontrado e corrigido antes de ligar a chave** (2026-08-11): o
  Ricardo partilhou o schema OpenAPI oficial da TollGuru
  (`toll-api-openapi-schema.json`) — `lib/portagens.ts` enviava o tipo de veículo
  como `vehicleType` solto; o schema real exige `vehicle: { type }` aninhado
  (corpo com `additionalProperties: false`). Corrigido; resto do parser
  (route/routes[0], distance.value em metros, costs.cash/tag/minimumTollCost)
  confirmado campo a campo contra o schema, sem alterações necessárias — ver
  lições
- [x] **Verificado em produção com a chave real** (2026-08-12): 1.º pedido
  direto à TollGuru (fora da app, `curl`, para isolar) devolveu dados reais e
  plausíveis — Lisboa→Porto, camião 2 eixos: 314 km, portagem 43,85 € (via
  A1) — confirma chave, conta e o fix de `vehicle.type` todos corretos
- [ ] **Ação do utilizador**: o plano trial (email pessoal) só dá **15
  pedidos/dia** — esgotado durante os testes de hoje (`"Request denied. You
  have exceeded daily quota of 15 transactions."`). Ou esperar o reset diário
  (a app continua a funcionar normalmente entretanto, cai no fallback da
  tabela por zona sempre que a quota está esgotada), ou adicionar cartão e
  mudar de plano na TollGuru se quiseres uso sem este limite
- [x] **Confirmado (2026-08-12): não é preciso nenhuma alteração de código
  para o trial expirar.** O Ricardo avisou que a chave só é válida 14 dias
  (~2026-08-26) e não quer pagar subscrição. `calcularPortagem()` já foi
  desenhada desde 2026-06-11 para nunca bloquear — qualquer falha (chave
  expirada, 401/403, rede) devolve só `erro` e a app cai sozinha na tabela
  por zona, sem nada visível a partir. Quando o trial acabar, não é preciso
  fazer nada: volta ao comportamento de sempre. Só **opcional**: remover
  `TOLLGURU_API_KEY` da Vercel depois de expirar, por arrumação (não é
  preciso para a app continuar a funcionar bem)

## 💶 Cobranças / contas a receber (prazo 90 dias) (2026-06-10)

Clientes têm 90 dias (a contar da data da paragem) para pagar. Separar "valor a
cobrar" (campo `receitaPaga`, só relabel) de "pago" (novo `pago` + `dataPagamento`).
Camada de tesouraria: NÃO afeta custo/lucro (totais validados intactos).

- [x] Schema: `Paragem.pago` (Bool) + `dataPagamento` (DateTime?) — `prisma db push` no Neon
- [x] `lib/calc/pagamentos.ts` (puro) `estadoPagamento()` + 6 testes (PAGO/A_AGUARDAR/VENCIDO)
- [x] `validacao.ts` (+pago/dataPagamento) e PATCH `/api/paragens/[id]`: set/clear
  dataPagamento + **guard snapshot** (só recongela se o veículo mudar)
- [x] `components/PagoToggle.tsx` (checkbox otimista) + `EstadoPagamentoBadge.tsx`
- [x] Carta "Cobranças" no detalhe da rota (Faturado/Recebido/Por receber/Vencidos + lista)
- [x] Página global `/escritorio/cobrancas` (vencidos primeiro) + menu com badge de vencidos
- [x] 47 testes verdes, build OK, db push OK → commit+push (deploy Vercel automático)

## 🗑️ Apagar rotas e paragens (2026-06-10)
- [x] API `DELETE /api/rotas/[idRota]` — apaga a rota inteira (deleteMany das
  paragens), escritório-only, 404 se não existir
- [x] Lista Rotas: nova coluna "Ações" + botão Apagar por rota (confirmação com nº
  de paragens) — `app/escritorio/rotas/ApagarRota.tsx`
- [x] Detalhe da rota: botão "Apagar" ao lado de "Editar" em cada paragem
  (reutiliza `DELETE /api/paragens/[id]`) — `components/ParagemAcoes.tsx`
- [x] Build OK, commit+push `1ede883` → deploy Vercel automático

## 🚚 Multi-motorista / multi-veículo (2026-06-10)

Cada motorista tem o seu salário/parâmetros e cada veículo os seus custos; ao
registar uma rota, as despesas usam os parâmetros do motorista + veículo usados
(frota partilhada) e ficam **congeladas** (snapshot) → histórico estável.

- [x] Schema: modelo `Veiculo`, `Pneu.veiculoId`, 7 campos salariais em `Utilizador`,
  `Paragem.veiculoId` + `snapshot Json`
- [x] Motor: `ParagemSnapshot` + `efetivos()`; cálculo usa snapshot (fallback contexto)
- [x] `lib/calc/snapshot.ts` (puro) + `lib/snapshot-service.ts` (DB) — congelam custos
- [x] APIs: paragens (veiculoId + snapshot), `/api/veiculos` CRUD, motoristas PATCH
  salário, parametros (pneus globais scoped)
- [x] UI: página Veículos, menu, salários em Motoristas, seletor de veículo no registo/editor
- [x] Seed + `prisma/migrate-multi-driver.ts`; 41 testes verdes, build OK, HILP01=1487,73 €
- [ ] **Produção (ação do utilizador)**: `prisma db push` no Neon + correr
  `npx tsx prisma/migrate-multi-driver.ts` (ver instruções no fim da conversa)

## 🚀 Deploy em produção (2026-06-10) — Opção A: hospedagem permanente

Objetivo: URL pública estável para partilhar a app (Next.js 14 + Prisma).

### Preparação de código (feito automaticamente)
- [x] Migrar schema Prisma `sqlite` → `postgresql`
- [x] `package.json`: `build = prisma generate && next build` + `postinstall: prisma generate`
- [x] Segurança: `.env` adicionado ao `.gitignore` (estava commitável) + `.env.example`
- [x] Gerar `AUTH_SECRET` de produção
- [x] `prisma generate` valida com provider postgres

### Passos do utilizador (contas externas)
- [x] Base Postgres na Neon criada
- [x] Schema sincronizado + dados locais (40 paragens/13 rotas) migrados p/ Neon
- [x] Migração SQLite→Neon (script prisma/migrate-sqlite-to-neon.ts) preservou ids/PINs
- [x] Repo GitHub gocris78-cmyk/app-logistica + push
- [x] Vercel: env vars DATABASE_URL + AUTH_SECRET definidas
- [x] Deploy OK → https://app-logistica-olive.vercel.app (login 200, API 401 ✓)
- [ ] Trocar PINs por defeito (escritório 1234 / motorista 0000) em produção —
  **confirmado ainda por trocar** (2026-08-11). Até agora não havia forma de o
  fazer pela app; ver "🔐 Alterar PIN" acima — falta só o Ricardo ir a
  `/escritorio/parametros` (PIN do escritório) e à ficha do motorista em
  `/escritorio/motoristas/[id]` (PIN do motorista) e definir valores novos

## Histórico de validação
- Importado o Excel real → 9 rotas batem ao cêntimo. 36 testes Vitest verdes. Build OK.
- Constantes: custo veículo/km 0,2746 € | motorista/km 0,26713 € | HILP01 = 1487,73 €.
