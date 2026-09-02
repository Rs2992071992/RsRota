import { z } from "zod";

export const TIPOS_VIAGEM = ["Ida", "Volta"] as const;
export const TIPOS_VEICULO = ["CAMIAO", "CAMIAO+REBOQUE", "VAZIO"] as const;

/** Tamanhos de palete — carga por volume (Paragem.volume=true), não por peso. */
export const TIPOS_PALETE = ["PALETE_120X80", "PALETE_120X100"] as const;

/** Rótulos amigáveis para os tamanhos de palete. */
export const ROTULOS_TIPO_PALETE: Record<string, string> = {
  PALETE_120X80: "Palete 120×80cm",
  PALETE_120X100: "Palete 120×100cm",
};

const numNaoNeg = z.number().nonnegative("Não pode ser negativo");
const numOpcional = z.number().nonnegative("Não pode ser negativo").nullable().optional();

/** Schema de uma paragem (entrada do motorista §3.1). */
export const paragemSchema = z
  .object({
    // Opcional: vazio/ausente => rota nova (o servidor gera o ID); preenchido => continuar rota.
    idRota: z.string().trim().optional(),
    data: z.string().min(1, "Data obrigatória"),
    tipoViagem: z.enum(TIPOS_VIAGEM),
    tipoVeiculo: z.enum(TIPOS_VEICULO),
    veiculoId: z.number().int().positive().nullable().optional(),
    cliente: z.string().trim().min(1, "Cliente obrigatório"),
    kmInicial: numNaoNeg,
    kmFinal: numNaoNeg,
    kgCarregados: numNaoNeg.default(0),
    kgDescarregados: numNaoNeg.default(0),
    // ⚠️ Legado (paragens registadas antes de 2026-08-28) — a UI de registo não
    // envia mais estes 2 campos, só tipoPaleteId/nPaletes abaixo.
    volume: z.boolean().default(false),
    tipoPalete: z.enum(TIPOS_PALETE).nullable().optional(),
    nPaletes: numNaoNeg.default(0),
    // Meias-paletes empilhadas em cima das de base (nPaletes) — não ocupam
    // base própria, só valem metade no rateio (lib/calc/perStop.ts).
    nMeiasPaletes: numNaoNeg.default(0),
    // Palete desta paragem (2026-08-28 em diante) — catálogo TipoPalete, único
    // modo para paragens novas exceto VAZIO (ver superRefine abaixo).
    tipoPaleteId: z.number().int().positive().nullable().optional(),
    // Várias linhas de palete na MESMA paragem (2026-09+) — tamanhos diferentes
    // para o mesmo cliente/descarga. Quando presente e não-vazio, substitui o
    // par tipoPaleteId/nPaletes acima (que a API preenche com o agregado). As
    // dimensões são resolvidas server-side a partir de cada tipoPaleteId.
    paletes: z
      .array(z.object({ tipoPaleteId: z.number().int().positive(), nPaletes: numNaoNeg }))
      .max(20)
      .optional(),
    pesoAproximado: numOpcional,
    litrosAbastecidos: numNaoNeg.default(0),
    custoAbastecido: numNaoNeg.default(0),
    zonaPortagem: z.string().trim().default(""),
    portagensExtra: numNaoNeg.default(0),
    noitesFora: numNaoNeg.default(0),
    alimentacao: numNaoNeg.default(0),
    horasExtra: numNaoNeg.default(0),
    // Recolha para entregar a outro cliente: `recolha` é o assinalar do
    // motorista (sem escolher destino); `faturarCliente` é o nome do
    // cliente a faturar, preenchido pelo escritório (null/vazio = fatura
    // normalmente ao próprio `cliente`).
    recolha: z.boolean().default(false),
    faturarCliente: z.string().trim().nullable().optional(),
    // Atribuição manual do custo de um troço VAZIO a clientes (km, não %) —
    // ver Paragem.rateioManual no schema. Sem teto ao somatório aqui: o
    // motor de cálculo escala defensivamente se somar mais do que o troço
    // fez (lib/calc/perRoute.ts::calcularRota).
    rateioManual: z
      .array(z.object({ cliente: z.string().trim().min(1), km: z.number().min(0) }))
      .max(10)
      .nullable()
      .optional(),
    precoCombRefOverride: numOpcional,
    receitaPaga: numNaoNeg.default(0),
    pago: z.boolean().default(false),
    dataPagamento: z.string().nullable().optional(),
    litrosEspanha: numOpcional,
    custoEspanha: numOpcional,
  })
  .superRefine((d, ctx) => {
    if (d.kmFinal < d.kmInicial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "KM Final deve ser ≥ KM Inicial",
        path: ["kmFinal"],
      });
    }
    if (d.volume && !d.tipoPalete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha o tipo de palete",
        path: ["tipoPalete"],
      });
    }
    // Paletes por dimensão são o único modo de rateio para paragens novas
    // (exceto VAZIO, que não transporta nada) — ver tasks/lessons.md 2026-08-28.
    if (d.tipoVeiculo !== "VAZIO") {
      if (d.paletes && d.paletes.length > 0) {
        // Modo multi-linha: cada linha precisa de nº de paletes > 0.
        d.paletes.forEach((l, i) => {
          if (!l.nPaletes || l.nPaletes <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Indique o nº de paletes",
              path: ["paletes", i, "nPaletes"],
            });
          }
        });
      } else if (!d.tipoPaleteId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Escolha o tipo de palete",
          path: ["tipoPaleteId"],
        });
      } else if ((!d.nPaletes || d.nPaletes <= 0) && (!d.nMeiasPaletes || d.nMeiasPaletes <= 0)) {
        // Basta ter paletes inteiras OU meias-paletes (uma meia sozinha, sem
        // base por baixo, é uma carga válida — ocupa chão no camião).
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Indique o nº de paletes ou de meias-paletes",
          path: ["nPaletes"],
        });
      }
    }
  });

export type ParagemForm = z.infer<typeof paragemSchema>;

/** Override do preço de ref. combustível para TODAS as paragens de uma rota
 * de uma vez (corrigir rota a rota sem editar paragem a paragem). null/vazio
 * = volta a usar o valor global de Parâmetros. */
export const rotaOverrideSchema = z.object({
  precoCombRefOverride: numOpcional,
});

export type RotaOverrideForm = z.infer<typeof rotaOverrideSchema>;

const n = z.number().finite();

/** Schema de um veículo da frota (custos próprios + pneus). */
export const veiculoSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  matricula: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
  valorAquisicao: n,
  valorResidual: n,
  vidaUtilAnos: n.positive("Deve ser > 0"),
  iucAnual: n,
  taxaJuros: n,
  seguroAnual: n,
  reparacoesAnuais: n,
  revisaoAnual: n,
  inspecaoAnual: n,
  capacidadeCamiao: n.positive("Deve ser > 0"),
  capacidadeReboque: n.positive("Deve ser > 0"),
  capacidadePaleteA: n.positive("Deve ser > 0"),
  capacidadePaleteB: n.positive("Deve ser > 0"),
  capacidadePaleteACamiao: n.positive("Deve ser > 0"),
  capacidadePaleteBCamiao: n.positive("Deve ser > 0"),
  // Caixa de carga (mm) — opcional, "só camião"; usada no empacotamento de
  // paletes (Cargas) e no rateio por dimensão (2026-08-28 em diante).
  caixaComprimentoMm: n.positive("Deve ser > 0").nullable().optional(),
  caixaLarguraMm: n.positive("Deve ser > 0").nullable().optional(),
  // Reboque ao qual este veículo está normalmente acoplado (rateio por
  // dimensão, CAMIAO+REBOQUE) + fator de segurança sobre a capacidade
  // geométrica calculada (1 = confiar na geometria).
  reboqueHabitualId: z.number().int().positive().nullable().optional(),
  fatorOcupacaoPalete: z.number().positive("Deve ser > 0").optional(),
  // Inspeção periódica — prazo + confirmação de que já foi feita.
  dataLimiteInspecao: z.string().trim().nullable().optional(),
  inspecaoVerificada: z.boolean().optional(),
  pneus: z.array(z.object({ eixo: z.string().trim().min(1), custo: n, km: n.positive() })),
});

export type VeiculoForm = z.infer<typeof veiculoSchema>;

/** Schema de uma manutenção/reparação de veículo. `valor`/`dias` ficam por
 * preencher até se saber o custo/tempo parado real. */
export const manutencaoSchema = z.object({
  descricao: z.string().trim().max(300).default(""),
  data: z.string().min(1, "Data obrigatória"),
  valor: z.number().nonnegative().nullable().optional(),
  dias: z.number().nonnegative().nullable().optional(),
});

export const manutencaoUpdateSchema = manutencaoSchema.partial();

export type ManutencaoForm = z.infer<typeof manutencaoSchema>;

/** Schema de um pedido de manutenção reportado pelo motorista (sinalização, sem custo). */
export const avariaSchema = z.object({
  veiculoId: z.number().int().positive(),
  data: z.string().min(1, "Data obrigatória"),
  itens: z.array(z.string().trim().min(1)).min(1, "Adicione pelo menos uma situação"),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

/** PATCH /api/avarias/[id] — só campos administrativos (só escritório). */
export const avariaUpdateSchema = z.object({
  observacoes: z.string().trim().max(1000).nullable().optional(),
  data: z.string().min(1).optional(),
});

/** PATCH /api/avarias/[id]/itens/[itemId] — toggle de 1 item (qualquer sessão). */
export const avariaItemUpdateSchema = z.object({
  resolvido: z.boolean(),
});

/** Schema dos parâmetros salariais próprios de um motorista. */
export const motoristaParamsSchema = z.object({
  nome: z.string().trim().nullable().optional(),
  salarioMensal: n,
  seguroMensal: n,
  percentEncargos: n,
  alimentacaoDia: n,
  diasAlimentacao: n,
  kmAnuais: n.positive("Deve ser > 0"),
  fatorAnualizacao: n,
  // Campos opcionais do registo, visíveis ou não consoante o motorista (ex.:
  // um motorista que nunca faz noites fora não precisa de ver esse campo).
  mostraNoitesFora: z.boolean().optional(),
  mostraAlimentacao: z.boolean().optional(),
  mostraHorasExtra: z.boolean().optional(),
});

export type MotoristaParamsForm = z.infer<typeof motoristaParamsSchema>;

/** Escritório muda o PIN de um motorista — já tem autoridade sobre a conta, não precisa do PIN antigo. */
export const alterarPinMotoristaSchema = z.object({
  pin: z.string().trim().min(4, "O PIN deve ter pelo menos 4 dígitos."),
});

/** Um utilizador (escritório ou motorista) muda o seu próprio PIN — exige o PIN atual como confirmação de identidade. */
export const alterarPinProprioSchema = z.object({
  pinAtual: z.string().trim().min(1, "Indique o PIN atual."),
  pinNovo: z.string().trim().min(4, "O novo PIN deve ter pelo menos 4 dígitos."),
});

/** Schema da ficha de contacto de um cliente (só dados de contacto). */
const txtContacto = z.string().trim().max(500).nullable().optional();
export const clienteContactoSchema = z.object({
  nome: z.string().trim().min(1, "Cliente obrigatório"),
  contato: txtContacto,
  telefone: txtContacto,
  email: txtContacto,
  morada: txtContacto,
  notas: txtContacto,
});

export type ClienteContactoForm = z.infer<typeof clienteContactoSchema>;

/** Agrupar/fundir variantes de nome de cliente num nome canónico. */
export const agruparClientesSchema = z.object({
  nomesVariantes: z.array(z.string().trim().min(1)).min(1, "Selecione pelo menos um nome"),
  nomeCanonico: z.string().trim().min(1, "Nome canónico obrigatório"),
});

export type AgruparClientesForm = z.infer<typeof agruparClientesSchema>;

/** Criar uma empresa-mãe nova (a quem se cobra um grupo de clientes). */
export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(100),
});

/** Atribuir um grupo de clientes a uma empresa-mãe. */
export const atribuirEmpresaSchema = z.object({
  nomes: z.array(z.string().trim().min(1)).min(1, "Selecione pelo menos um nome"),
  empresaId: z.number().int().positive(),
});

/** PDF de uma seleção manual de linhas de cobrança (checkboxes na tabela). */
export const selecaoCobrancaSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Selecione pelo menos uma linha"),
  titulo: z.string().trim().max(100).optional(),
});

/** Estados possíveis de um orçamento. */
export const ESTADOS_DEVIS = ["RASCUNHO", "ENVIADO", "ACEITE", "RECUSADO"] as const;

/** Uma linha de orçamento (corresponde a LinhaDevis em lib/calc/orcamento.ts). */
export const linhaDevisSchema = z.object({
  descricao: z.string().trim().max(300).default(""),
  origem: z.string().trim().max(300).default(""),
  destino: z.string().trim().max(300).default(""),
  kmAuto: z.number().nonnegative().nullable().default(null),
  idaVolta: z.boolean().default(true),
  km: numNaoNeg.default(0),
  pesoKg: numNaoNeg.default(0),
  tipoVeiculo: z.enum(TIPOS_VEICULO).default("CAMIAO"),
  // ⚠️ Legado — ver tipoPaleteId/nPaletes abaixo (único modo para linhas novas).
  volume: z.boolean().default(false),
  tipoPalete: z.enum(TIPOS_PALETE).nullable().optional(),
  nPaletes: numNaoNeg.default(0),
  // Meias-paletes empilhadas — não ocupam base própria, só valem metade no rateio.
  nMeiasPaletes: numNaoNeg.default(0),
  // Palete desta linha (2026-08-28 em diante) — catálogo TipoPalete + as
  // dimensões congeladas (fonte de verdade do cálculo, ver estimarLinha).
  tipoPaleteId: z.number().int().positive().nullable().optional(),
  paleteComprimentoMm: z.number().positive().nullable().optional(),
  paleteLarguraMm: z.number().positive().nullable().optional(),
  pesoAproximado: numOpcional,
  zonaPortagem: z.string().trim().max(120).nullable().default(null),
  noitesFora: numNaoNeg.default(0),
  alimentacao: numNaoNeg.default(0),
  custoEstimado: numNaoNeg.default(0),
  preco: numNaoNeg.default(0),
});

/** Schema de criação de um orçamento. O número e os totais são calculados no servidor. */
export const devisSchema = z.object({
  cliente: z.string().trim().min(1, "Cliente obrigatório"),
  clienteEmail: txtContacto,
  clienteMorada: txtContacto,
  clienteContato: txtContacto,
  validade: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_DEVIS).default("RASCUNHO"),
  origemPadrao: txtContacto,
  linhas: z.array(linhaDevisSchema).default([]),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  ivaPercent: z.number().min(0).max(100).default(23),
});

export type DevisForm = z.infer<typeof devisSchema>;

/** Entrada do endpoint de estimativa de uma linha (calcula km via mapas + custo). */
export const estimarDevisSchema = z.object({
  origem: z.string().trim().default(""),
  destino: z.string().trim().default(""),
  idaVolta: z.boolean().default(true),
  pesoKg: numNaoNeg.default(0),
  tipoVeiculo: z.enum(TIPOS_VEICULO).default("CAMIAO"),
  volume: z.boolean().default(false),
  tipoPalete: z.enum(TIPOS_PALETE).nullable().optional(),
  nPaletes: numNaoNeg.default(0),
  nMeiasPaletes: numNaoNeg.default(0),
  tipoPaleteId: z.number().int().positive().nullable().optional(),
  pesoAproximado: numOpcional,
  zonaPortagem: z.string().trim().nullable().default(null),
  noitesFora: numNaoNeg.default(0),
  alimentacao: numNaoNeg.default(0),
  motoristaId: z.number().int().positive().nullable().optional(),
  veiculoId: z.number().int().positive().nullable().optional(),
  /** Se preenchido, ignora o cálculo automático de distância e usa este km (ida). */
  kmManual: z.number().nonnegative().nullable().optional(),
});

export type EstimarDevisForm = z.infer<typeof estimarDevisSchema>;

// --- Cargas / empacotamento de paletes -----------------------------------

/** Catálogo de tipos de palete (mm), editável em Parâmetros. */
export const tipoPaleteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  comprimentoMm: n.positive("Deve ser > 0"),
  larguraMm: n.positive("Deve ser > 0"),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

export const tipoPaleteUpdateSchema = tipoPaleteSchema.partial();

export type TipoPaleteForm = z.infer<typeof tipoPaleteSchema>;

/** Catálogo de reboques (mm) — independente do veículo, escolhido por carregamento. */
export const reboqueSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  matricula: z.string().trim().nullable().optional(),
  comprimentoMm: n.positive("Deve ser > 0"),
  larguraMm: n.positive("Deve ser > 0"),
  ativo: z.boolean().optional(),
});

export const reboqueUpdateSchema = reboqueSchema.partial();

export type ReboqueForm = z.infer<typeof reboqueSchema>;

export const ESTADOS_CARREGAMENTO = ["ABERTO", "FECHADO"] as const;

/** Criação de um carregamento (sessão de carga) para um veículo. */
export const carregamentoSchema = z.object({
  veiculoId: z.number().int().positive("Veículo obrigatório"),
  data: z.string().nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
});

export type CarregamentoForm = z.infer<typeof carregamentoSchema>;

/** Atualização de um carregamento: anexar/trocar/remover reboque, fechar/reabrir, notas. */
export const carregamentoUpdateSchema = z.object({
  estado: z.enum(ESTADOS_CARREGAMENTO).optional(),
  reboqueId: z.number().int().positive().nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
});

export type CarregamentoUpdateForm = z.infer<typeof carregamentoUpdateSchema>;

/** Linha de pedido: cliente + tipo de palete + quantidade. Guarda-se mesmo
 * que não caiba fisicamente (o compromisso ao cliente já foi feito). */
export const pedidoPaleteSchema = z.object({
  clienteId: z.number().int().positive("Cliente obrigatório"),
  tipoPaleteId: z.number().int().positive("Tipo de palete obrigatório"),
  quantidade: z.number().int().positive("Quantidade deve ser > 0"),
});

export type PedidoPaleteForm = z.infer<typeof pedidoPaleteSchema>;

/** Orientação forçada das paletes de uma linha de pedido na planta de carga. */
export const ORIENTACOES_PALETE = ["AUTO", "COMPRIDO", "TRAVES"] as const;

export const pedidoPaleteUpdateSchema = z
  .object({
    quantidade: z.number().int().positive("Quantidade deve ser > 0").optional(),
    orientacao: z.enum(ORIENTACOES_PALETE).optional(),
  })
  .refine((d) => d.quantidade !== undefined || d.orientacao !== undefined, {
    message: "Nada para atualizar.",
  });

export type PedidoPaleteUpdateForm = z.infer<typeof pedidoPaleteUpdateSchema>;

/** Nova ordem de carga: `pedidoId` de todos os pedidos do carregamento, na
 * sequência pretendida. A rota valida que é uma permutação exata dos pedidos. */
export const reordenarPedidosSchema = z.object({
  ordemPedidoIds: z.array(z.number().int().positive()).min(1),
});

/** Quantas paletes separar de uma linha de pedido para uma linha nova (mesmo
 * cliente/tipo) — para lhes poder dar orientações diferentes. */
export const dividirPedidoSchema = z.object({
  quantidade: z.number().int().positive("Tem de ser > 0"),
});

export type ReordenarPedidosForm = z.infer<typeof reordenarPedidosSchema>;
