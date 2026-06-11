# TODO — App de Gestão e Rentabilidade de Rotas

Plano completo: `/Users/miguel/.claude/plans/quero-que-construas-uma-piped-sphinx.md`

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
