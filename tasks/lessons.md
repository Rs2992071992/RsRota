# Lições aprendidas

Formato: [data] | o que correu mal | regra para evitar

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
