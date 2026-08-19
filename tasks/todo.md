# TODO — App de Gestão e Rentabilidade de Rotas

Plano completo: `/Users/miguel/.claude/plans/quero-que-construas-uma-piped-sphinx.md`

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
- [ ] **Ação do utilizador**: reinstalar (sideload) o novo `.apk` no
  telemóvel do motorista para a aba "Avarias" (+ email) aparecer

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

### Fase 2, Entrega 2 — SQLite + sincronização offline (por fazer)
- [ ] SQLite local (`@capacitor-community/sqlite`) com 2 zonas:
  - cache de dados de referência (zonas de portagem, veículos, clientes,
    rotas recentes) — atualizada sempre que há rede
  - fila de "paragens por sincronizar" (criadas offline)
- [ ] Regra combinada com o Ricardo antes de implementar: **iniciar uma
  rota NOVA exige rede** (o ID é gerado pelo servidor, evita conflitos);
  **continuar uma rota já ativa funciona offline** (cada paragem nova é
  só enfileirada localmente, sem depender de ID novo)
- [ ] Sincronização automática ao recuperar rede (plugin `Network` do
  Capacitor) + botão manual "Sincronizar agora"; UI mostra claramente
  paragens "por sincronizar" vs "sincronizadas"
- [ ] As notas "já introduzido" (noites/alimentação/portagens/zona,
  já implementadas na Entrega 1) passam a olhar também para a fila
  local, não só para a API — para continuarem a evitar duplicação mesmo
  offline
- [ ] Teste manual completo: registar 3 paragens em modo avião, sincronizar
  ao voltar a rede, confirmar no escritório que ficaram todas certas (sem
  duplicados, sem perdas)

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
