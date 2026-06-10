# Lições aprendidas

Formato: [data] | o que correu mal | regra para evitar

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
