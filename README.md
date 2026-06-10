# App de Gestão e Rentabilidade de Rotas (Portugal ⇄ Espanha)

Aplicação web que substitui a folha de Excel de análise de rentabilidade de rotas de
transporte rodoviário (camião e camião+reboque). Replica a lógica de cálculo do Excel com
exatidão e acrescenta um painel de parâmetros editável, validação de dados, rateio de
custo por cliente auditável e um dashboard de rentabilidade com histórico mensal.

O coração da app é o **alerta automático**: para cada rota compara a receita paga pelos
clientes com o custo real e assinala 🟢 OK ou 🔴 PREJUÍZO.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — frontend e backend num só projeto
- **Prisma** + **SQLite** — base de dados local (migrável para Postgres)
- **Tailwind CSS** — interface (Português de Portugal)
- **Recharts** — gráficos do dashboard
- **Vitest** — testes da lógica de cálculo

A lógica de negócio vive em [`lib/calc/`](lib/calc/) como funções **puras** (sem
dependências de framework ou BD), totalmente coberta por testes. A camada de dados está
isolada em [`lib/db.ts`](lib/db.ts) e [`prisma/schema.prisma`](prisma/schema.prisma):
migrar para Postgres é mudar o `provider` e o `DATABASE_URL`.

## Instalação e arranque

Requisitos: Node.js 18+.

```bash
# 1. Instalar dependências
npm install

# 2. Criar a base de dados e preencher os parâmetros atuais (§3.4)
npm run db:reset      # cria/recria a BD SQLite + seed

# 3. Arrancar em desenvolvimento
npm run dev           # http://localhost:3000
```

### Perfis e acesso (alterar em produção)

| Perfil      | Login                    | Acesso                                          |
| ----------- | ------------------------ | ----------------------------------------------- |
| Motorista   | ID + PIN (ex.: `motorista` / `0000`) | Registo, histórico e correção das suas paragens |
| Escritório  | PIN (`1234`)             | Dashboards, rotas, motoristas, parâmetros, importar/exportar |

Há **vários motoristas**: cada um tem um ID e um PIN próprios e pode ser criado diretamente
na página de login (“Criar motorista”). O escritório vê e gere os motoristas em
**Motoristas**. As contas iniciais são definidas em [`prisma/seed.ts`](prisma/seed.ts). Para
produção, defina também `AUTH_SECRET` no `.env` (assina a cookie de sessão `perfil:id`).

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm start          # servir build de produção
npm test           # correr os testes da lógica de cálculo
npm run db:seed    # (re)preencher parâmetros e tabelas
npm run db:reset   # recriar a BD do zero + seed
npm run db:studio  # explorar a BD (Prisma Studio)
```

## Importar os dados do Excel

1. Entre como **Escritório** → **Importar**.
2. Carregue o ficheiro `viagens_app_final_profissional.xlsx`.
3. A app lê a folha **Viagens_APP** (a mais completa, com a receita por cliente) e cria as
   paragens. ⚠️ A importação **substitui** as paragens existentes.

Linhas sem data válida recebem a data de importação (podem ser corrigidas depois).

## Lógica de cálculo (resumo)

Toda em [`lib/calc/`](lib/calc/), validada contra o Excel:

- **Custo do veículo/km ≈ 0,2746 €** — custos fixos (juros + seguro + IUC + depreciação) +
  manutenção (reparações + pneus + revisão + inspeção).
- **Custo do motorista/km ≈ 0,2671 €** — `(custo mensal × 14) / 95.000`. O **×14** são os
  14 salários/ano em Portugal (12 meses + subsídio de Natal + subsídio de férias); é um
  parâmetro editável.
- **Custo da paragem** = portagens extra + combustível + motorista + veículo + AdBlue.
- **Custo da rota** = Σ custos das paragens + noites + alimentação + horas extra valorizadas
  + portagens da tabela.
- **Rateio por cliente** = coeficiente real × custo total da rota (visível e auditável no
  detalhe da rota).
- **Preço mínimo** = custo × 1,25 (margem de 25%).
- **Alerta** = receita − custo < 0 → 🔴 PREJUÍZO.

Caso de referência validado (Excel, rota HILP01): CAMIAO+REBOQUE, 28.000 kg, 580 km →
custo da paragem **797,24 €**; rota completa → custo **1.487,73 €**, lucro **212,27 €**.

### Dois preços de combustível

- **Preço de referência** (`precoCombRef`, ~1,834 €/L) — usado no cálculo do custo. Muda
  mensalmente; editável no painel de parâmetros, com override opcional por paragem.
- **Preço real pago** — informativo. As colunas **Espanha** mostram a poupança estimada de
  abastecer mais barato em Espanha, sem nunca afetar o custo nem o alerta.

## Estrutura do projeto

```
app/                  Páginas e rotas API (Next.js App Router)
  login/              Login por PIN
  motorista/registo/  Formulário mobile-first de registo de paragens
  escritorio/         Dashboard, rotas, parâmetros, importar/exportar
  api/                Endpoints (auth, paragens, parametros, importar, exportar)
lib/
  calc/               Motor de cálculo PURO (+ testes em tests/calc)
  db.ts               Cliente Prisma (camada de dados isolada)
  contexto.ts         Ponte BD -> motor de cálculo
  rotas-service.ts    Carregamento e cálculo de rotas (escritório)
  dashboard-service.ts KPIs e dados dos gráficos
prisma/               schema + seed (parâmetros atuais)
tests/calc/           Testes Vitest com casos reais do Excel
```

## Testes

```bash
npm test
```

Cobrem a secção 4 da especificação: lookups, custos derivados (0,2746 / 0,2671), cálculo de
paragem (caso 797,24 €), cálculo de rota (HILP01: custo 1.487,73 €, lucro 212,27 €), o
coeficiente real corrigido e a poupança Espanha.
