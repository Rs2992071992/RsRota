# TODO — App de Gestão e Rentabilidade de Rotas

Plano completo: `/Users/miguel/.claude/plans/quero-que-construas-uma-piped-sphinx.md`

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
- [ ] **Ação do utilizador**: criar chave grátis OpenRouteService → `ORS_API_KEY` no
  `.env` local **e** nas env vars da Vercel (sem ela, o km automático fica off; o km
  manual continua a funcionar)
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
- [ ] **Ação do utilizador**: criar chave grátis TollGuru → `TOLLGURU_API_KEY` no `.env`
  local **e** na Vercel (sem ela, portagens continuam pela tabela por zona)
- [ ] **Verificar em produção** o parsing da resposta TollGuru (campos costs/summary)
  no 1.º cálculo real e afinar `lib/portagens.ts` se necessário

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
- [ ] Trocar PINs por defeito (escritório 1234 / motorista 0000) em produção

## Histórico de validação
- Importado o Excel real → 9 rotas batem ao cêntimo. 36 testes Vitest verdes. Build OK.
- Constantes: custo veículo/km 0,2746 € | motorista/km 0,26713 € | HILP01 = 1487,73 €.
