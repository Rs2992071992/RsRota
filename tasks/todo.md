# TODO — App de Gestão e Rentabilidade de Rotas

Plano completo: `/Users/miguel/.claude/plans/quero-que-construas-uma-piped-sphinx.md`

## Fases (concluídas)
- [x] Fase 1–7 — App completa, validada end-to-end (ver histórico abaixo)

## 🚀 Deploy em produção (2026-06-10) — Opção A: hospedagem permanente

Objetivo: URL pública estável para partilhar a app (Next.js 14 + Prisma).

### Preparação de código (feito automaticamente)
- [x] Migrar schema Prisma `sqlite` → `postgresql`
- [x] `package.json`: `build = prisma generate && next build` + `postinstall: prisma generate`
- [x] Segurança: `.env` adicionado ao `.gitignore` (estava commitável) + `.env.example`
- [x] Gerar `AUTH_SECRET` de produção
- [x] `prisma generate` valida com provider postgres

### Passos do utilizador (contas externas)
- [ ] Criar base Postgres gratuita na Neon (https://neon.tech)
- [ ] `DATABASE_URL` local → Neon; correr `npm run db:push && npm run db:seed`
- [ ] (Opcional) Re-importar o Excel real pela UI de importação
- [ ] Criar repo GitHub e fazer push
- [ ] Importar projeto na Vercel; definir env vars `DATABASE_URL` + `AUTH_SECRET`
- [ ] Deploy → obter URL pública
- [ ] Trocar PINs por defeito (escritório 1234 / motorista 0000) em produção

## Histórico de validação
- Importado o Excel real → 9 rotas batem ao cêntimo. 36 testes Vitest verdes. Build OK.
- Constantes: custo veículo/km 0,2746 € | motorista/km 0,26713 € | HILP01 = 1487,73 €.
