"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CarregamentoDetalhe, SimulacaoOrdem } from "@/lib/carregamento-service";
import CarregamentoFloorPlan from "@/components/CarregamentoFloorPlan";
import DescarregarPdfBotao from "@/components/DescarregarPdfBotao";
import { reordenarArrastando } from "@/lib/carregamento-ordem";

type Detalhe = Omit<CarregamentoDetalhe, "data"> & { data: string };

interface ClienteOpcao {
  id: number;
  nome: string;
}

interface TipoPaleteOpcao {
  id: number;
  nome: string;
  comprimentoMm: number;
  larguraMm: number;
}

interface ReboqueOpcao {
  id: number;
  nome: string;
  matricula: string | null;
  comprimentoMm: number;
  larguraMm: number;
  ativo: boolean;
}

function agruparNaoColocados(naoColocados: Detalhe["packing"]["naoColocados"]) {
  const grupos = new Map<
    string,
    { clienteNome: string; tipoPaleteNome: string; motivo: string; quantidade: number }
  >();
  for (const n of naoColocados) {
    const chave = `${n.unidade.clienteId}-${n.unidade.tipoPaleteId}-${n.motivo}`;
    const atual = grupos.get(chave);
    if (atual) atual.quantidade += 1;
    else {
      grupos.set(chave, {
        clienteNome: n.unidade.clienteNome,
        tipoPaleteNome: n.unidade.tipoPaleteNome,
        motivo: n.motivo,
        quantidade: 1,
      });
    }
  }
  return [...grupos.values()];
}

const metros = (mm: number) => (mm / 1000).toFixed(1);

/** Frases curtas a mostrar no painel "Otimizar disposição". */
function linhasGanho(g: SimulacaoOrdem["ganho"]): string[] {
  const linhas: string[] = [];
  if (g.naoColocadosDepois < g.naoColocadosAntes) {
    linhas.push(
      g.naoColocadosDepois === 0
        ? `Passam a caber todas as paletes (agora ${g.naoColocadosAntes} sem espaço).`
        : `Menos ${g.naoColocadosAntes - g.naoColocadosDepois} paletes sem espaço (${g.naoColocadosDepois} ainda ficam de fora).`,
    );
  }
  if (g.usaReboqueAntes && !g.usaReboqueDepois) {
    linhas.push("Deixa de ser preciso usar o reboque.");
  }
  if (g.comprimentoAntesMm - g.comprimentoDepoisMm > 50) {
    linhas.push(
      `Ocupa ${metros(g.comprimentoDepoisMm)} m em vez de ${metros(g.comprimentoAntesMm)} m de comprimento.`,
    );
  }
  if (linhas.length === 0) linhas.push("Melhora ligeiramente o aproveitamento do espaço.");
  return linhas;
}

export default function CarregamentoDetalheEditor({
  detalheInicial,
  clientes,
  nomesClientesConhecidos,
  reboquesAtivos,
  tiposPaleteAtivos,
}: {
  detalheInicial: Detalhe;
  clientes: ClienteOpcao[];
  /** Todos os nomes já conhecidos (rotas, orçamentos, fichas de contacto) —
   * sugeridos no campo de cliente, mesmo sem ficha `Cliente` criada ainda. */
  nomesClientesConhecidos: string[];
  reboquesAtivos: ReboqueOpcao[];
  tiposPaleteAtivos: TipoPaleteOpcao[];
}) {
  const router = useRouter();
  // Fonte de verdade: vem sempre recalculada do servidor (packing incluído)
  // depois de cada router.refresh() — não guardamos cópia local editável.
  const detalhe = detalheInicial;

  // Cópia local (não só a prop): permite reconhecer de imediato um cliente
  // criado agora mesmo, sem esperar pelo router.refresh().
  const [clientesLocal, setClientesLocal] = useState<ClienteOpcao[]>(clientes);
  const [clienteNome, setClienteNome] = useState(clientesLocal[0]?.nome ?? "");
  const [tipoPaleteId, setTipoPaleteId] = useState<number | "">(tiposPaleteAtivos[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(1);
  const [reboqueEscolhido, setReboqueEscolhido] = useState<number | "">("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState("");
  const [aRenomearCliente, setARenomearCliente] = useState(false);
  const [novoNomeCliente, setNovoNomeCliente] = useState("");
  const [aGuardarNome, setAGuardarNome] = useState(false);
  const [aOtimizar, setAOtimizar] = useState(false);
  const [aReordenar, setAReordenar] = useState(false);
  const [simulacao, setSimulacao] = useState<SimulacaoOrdem | null>(null);

  // Sugestões no combobox: fichas já criadas + todos os nomes conhecidos
  // (rotas/orçamentos), para não obrigar a "criar ficha" antes de poder usar
  // um cliente que já existe no resto da app.
  const sugestoesNomes = [...new Set([...clientesLocal.map((c) => c.nome), ...nomesClientesConhecidos])].sort(
    (a, b) => a.localeCompare(b),
  );
  const clienteExistente = sugestoesNomes.some(
    (n) => n.toLowerCase() === clienteNome.trim().toLowerCase(),
  );

  const naoColocadosAgrupados = agruparNaoColocados(detalhe.packing.naoColocados);
  const reboquesParaAnexar = reboquesAtivos.filter((r) => r.id !== detalhe.reboque?.id);

  /** Devolve o id do Cliente com este nome, criando a ficha agora se ainda não existir. */
  async function resolverClienteId(nome: string): Promise<number | null> {
    const existente = clientesLocal.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    if (existente) return existente.id;

    const res = await fetch("/api/clientes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao criar cliente.");
      return null;
    }
    const { cliente } = await res.json();
    setClientesLocal((cs) => [...cs, { id: cliente.id, nome: cliente.nome }]);
    return cliente.id;
  }

  /** Renomeia um cliente em toda a app (rotas, orçamentos, pedidos de paletes,
   * ficha) — reaproveita /api/clientes/agrupar (funde o nome atual, como
   * única "variante", no novo nome canónico), em vez de um rename cru que
   * deixaria o histórico antigo desligado da ficha. */
  async function renomearCliente() {
    const nomeAtual = clienteNome.trim();
    const novoNome = novoNomeCliente.trim();
    if (!nomeAtual || !novoNome) {
      setErro("Indique o novo nome.");
      return;
    }
    if (nomeAtual.toLowerCase() === novoNome.toLowerCase()) {
      setARenomearCliente(false);
      return;
    }
    setErro("");
    setAGuardarNome(true);
    try {
      const res = await fetch("/api/clientes/agrupar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomesVariantes: [nomeAtual], nomeCanonico: novoNome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao renomear.");
        return;
      }
      // O id da ficha pode ter mudado (fusão) — removemos a entrada antiga e
      // deixamos o próximo resolverClienteId() ir buscar/criar a atual.
      setClientesLocal((cs) => cs.filter((c) => c.nome.toLowerCase() !== nomeAtual.toLowerCase()));
      setClienteNome(novoNome);
      setARenomearCliente(false);
      setNovoNomeCliente("");
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGuardarNome(false);
    }
  }

  async function adicionarPedido() {
    setErro("");
    const nome = clienteNome.trim();
    if (!nome || !tipoPaleteId || quantidade <= 0) {
      setErro("Escolha o cliente, o tipo de palete e uma quantidade válida.");
      return;
    }
    setAGuardar(true);
    try {
      const clienteId = await resolverClienteId(nome);
      if (!clienteId) return;

      const res = await fetch(`/api/carregamentos/${detalhe.id}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, tipoPaleteId, quantidade }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao adicionar pedido.");
        return;
      }
      setClienteNome("");
      setQuantidade(1);
      setSimulacao(null);
      // Reaproveita a arrumação mais compacta a cada palete nova, em vez de
      // esperar por um clique manual em "Otimizar disposição" — melhor esforço,
      // não bloqueia o sucesso do pedido se falhar.
      await fetch(`/api/carregamentos/${detalhe.id}/otimizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aplicar: true }),
      }).catch(() => {});
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAGuardar(false);
    }
  }

  async function removerPedido(pedidoId: number) {
    if (!confirm("Remover esta linha de pedido?")) return;
    const res = await fetch(`/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao remover.");
      return;
    }
    setSimulacao(null);
    router.refresh();
  }

  /** Grava uma nova sequência de carga (lista completa de pedidoId). */
  async function gravarOrdem(ordemPedidoIds: number[]) {
    const res = await fetch(`/api/carregamentos/${detalhe.id}/pedidos/ordem`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordemPedidoIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao reordenar.");
      return false;
    }
    return true;
  }

  /** Arrasto na planta: `pedidoId` foi largado antes/depois de `alvoPedidoId`.
   * Se a linha de `pedidoId` tiver mais do que 1 palete, só a palete arrastada
   * se deve mudar de posição — separa-a primeiro numa linha de 1 (mesmo padrão
   * do ↻, `dividir` com `quantidade:1`) e reordena essa linha nova. Com 1 só
   * palete na linha, reordena a linha diretamente, como antes. */
  async function moverPalete(pedidoId: number, alvoPedidoId: number, posicao: "antes" | "depois") {
    setErro("");
    setSimulacao(null);
    setAReordenar(true);
    try {
      const linha = detalhe.pedidos.find((p) => p.id === pedidoId);
      let pedidosAtuais: Detalhe["pedidos"] = detalhe.pedidos;
      let idParaMover = pedidoId;

      if (linha && linha.quantidade > 1) {
        const resDividir = await fetch(
          `/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}/dividir`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantidade: 1 }),
          },
        );
        const dataDividir = await resDividir.json().catch(() => ({}));
        if (!resDividir.ok) {
          setErro(dataDividir.erro || "Erro ao separar a palete.");
          return;
        }
        pedidosAtuais = dataDividir.carregamento.pedidos;
        const idsAntigos = new Set(detalhe.pedidos.map((p) => p.id));
        const novaLinha = pedidosAtuais.find((p) => !idsAntigos.has(p.id));
        if (!novaLinha) {
          setErro("Erro ao separar a palete.");
          return;
        }
        idParaMover = novaLinha.id;
      }

      const ordemAtual = pedidosAtuais.map((p) => p.id);
      const novaOrdem = reordenarArrastando(ordemAtual, idParaMover, alvoPedidoId, posicao);
      if (novaOrdem !== ordemAtual && !(await gravarOrdem(novaOrdem))) return;
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAReordenar(false);
    }
  }

  /** ↻ na planta: separa a palete clicada numa linha própria e roda só essa.
   * Se a linha já só tem 1 palete, alterna a orientação sem criar linha nova. */
  async function rodarPalete(pedidoId: number, rotacionadoAtual: boolean) {
    setErro("");
    setSimulacao(null);
    setAReordenar(true);
    const alvo = rotacionadoAtual ? "COMPRIDO" : "TRAVES";
    const linha = detalhe.pedidos.find((p) => p.id === pedidoId);
    try {
      const res =
        linha && linha.quantidade === 1
          ? await fetch(`/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orientacao: alvo }),
            })
          : await fetch(`/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}/dividir`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantidade: 1, orientacao: alvo }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.erro || "Erro ao rodar a palete.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAReordenar(false);
    }
  }

  async function rodarPedido(pedidoId: number, orientacao: "AUTO" | "COMPRIDO" | "TRAVES") {
    setErro("");
    setSimulacao(null);
    const res = await fetch(`/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orientacao }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao rodar a palete.");
      return;
    }
    router.refresh();
  }

  async function dividirPedido(pedidoId: number, quantidadeAtual: number) {
    let separar = 1;
    if (quantidadeAtual > 2) {
      const resp = prompt(
        `Quantas das ${quantidadeAtual} paletes separar para uma linha nova?`,
        "1",
      );
      if (resp === null) return;
      separar = Number(resp);
      if (!Number.isInteger(separar) || separar < 1 || separar >= quantidadeAtual) {
        setErro(`Indique um número entre 1 e ${quantidadeAtual - 1}.`);
        return;
      }
    }
    setErro("");
    setSimulacao(null);
    const res = await fetch(
      `/api/carregamentos/${detalhe.id}/pedidos/${pedidoId}/dividir`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: separar }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao dividir a linha.");
      return;
    }
    router.refresh();
  }

  async function otimizar() {
    setErro("");
    setAOtimizar(true);
    try {
      const res = await fetch(`/api/carregamentos/${detalhe.id}/otimizar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao otimizar.");
        return;
      }
      setSimulacao(data.simulacao as SimulacaoOrdem);
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAOtimizar(false);
    }
  }

  async function aplicarOtimizacao() {
    setErro("");
    setAOtimizar(true);
    try {
      const res = await fetch(`/api/carregamentos/${detalhe.id}/otimizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aplicar: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || "Erro ao aplicar.");
        return;
      }
      setSimulacao(null);
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setAOtimizar(false);
    }
  }

  async function anexarReboque(reboqueId: number | null) {
    setErro("");
    const res = await fetch(`/api/carregamentos/${detalhe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reboqueId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao atualizar o reboque.");
      return;
    }
    setReboqueEscolhido("");
    router.refresh();
  }

  async function alternarEstado() {
    const novoEstado = detalhe.estado === "ABERTO" ? "FECHADO" : "ABERTO";
    const res = await fetch(`/api/carregamentos/${detalhe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: novoEstado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao atualizar o estado.");
      return;
    }
    router.refresh();
  }

  async function apagar() {
    if (!confirm("Apagar este carregamento e todos os seus pedidos?")) return;
    const res = await fetch(`/api/carregamentos/${detalhe.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.erro || "Erro ao apagar.");
      return;
    }
    router.push("/escritorio/cargas");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{detalhe.veiculo.nome}</h1>
          <p className="text-sm text-gray-500">
            {detalhe.veiculo.matricula || "sem matrícula"} ·{" "}
            {new Date(detalhe.data).toLocaleDateString("pt-PT")}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={alternarEstado} className="btn-secondary text-sm">
            {detalhe.estado === "ABERTO" ? "Fechar carregamento" : "Reabrir carregamento"}
          </button>
          <button onClick={apagar} className="text-sm font-medium text-red-600 hover:text-red-800">
            Apagar
          </button>
        </div>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {/* Reboque */}
      <div className="card">
        <h3 className="mb-2 font-semibold">Reboque</h3>
        {detalhe.reboque ? (
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-bold">{detalhe.reboque.nome}</span> — {detalhe.reboque.comprimentoMm} ×{" "}
              {detalhe.reboque.larguraMm} mm
            </p>
            <button onClick={() => anexarReboque(null)} className="text-sm text-red-500 hover:text-red-700">
              Remover
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sem reboque anexado a este carregamento.</p>
        )}

        {reboquesParaAnexar.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select
              className="input"
              value={reboqueEscolhido}
              onChange={(e) => setReboqueEscolhido(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">
                {detalhe.reboque ? "Trocar por…" : "Escolher reboque…"}
              </option>
              {reboquesParaAnexar.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} ({r.comprimentoMm}×{r.larguraMm}mm)
                </option>
              ))}
            </select>
            <button
              onClick={() => reboqueEscolhido && anexarReboque(reboqueEscolhido)}
              disabled={!reboqueEscolhido}
              className="btn-secondary whitespace-nowrap text-sm"
            >
              Anexar
            </button>
          </div>
        )}
      </div>

      {/* Sugestão de reboque quando há paletes sem espaço */}
      {detalhe.sugestoesReboque && detalhe.sugestoesReboque.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            Há paletes sem espaço — sugestão de reboque:
          </p>
          <div className="flex flex-wrap gap-2">
            {detalhe.sugestoesReboque.map((s) => (
              <button
                key={s.id}
                onClick={() => anexarReboque(s.id)}
                className="btn-secondary text-sm"
              >
                Anexar {s.nome} ({s.comprimentoMm}×{s.larguraMm}mm
                {s.caberiamTodos ? " — resolve tudo" : ` — cabem ${s.quantosCabemDosEmFalta}`})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Adicionar pedido */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Adicionar pedido</h3>
        {tiposPaleteAtivos.length === 0 ? (
          <p className="text-sm text-gray-500">
            É preciso ter pelo menos um tipo de palete ativo (em Parâmetros) para adicionar pedidos.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="label">Cliente</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  list="clientes-sugestoes"
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
                {clienteExistente && !aRenomearCliente && (
                  <button
                    onClick={() => {
                      setNovoNomeCliente(clienteNome.trim());
                      setARenomearCliente(true);
                    }}
                    title="Editar nome deste cliente"
                    className="btn-secondary whitespace-nowrap text-sm"
                  >
                    ✎ Editar nome
                  </button>
                )}
              </div>
              <datalist id="clientes-sugestoes">
                {sugestoesNomes.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              {aRenomearCliente ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                  <span className="whitespace-nowrap text-xs text-amber-800">
                    Renomear &quot;{clienteNome.trim()}&quot; para:
                  </span>
                  <input
                    className="input"
                    value={novoNomeCliente}
                    onChange={(e) => setNovoNomeCliente(e.target.value)}
                  />
                  <button
                    onClick={renomearCliente}
                    disabled={aGuardarNome}
                    className="btn-secondary whitespace-nowrap text-sm"
                  >
                    {aGuardarNome ? "A guardar…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => {
                      setARenomearCliente(false);
                      setNovoNomeCliente("");
                    }}
                    className="whitespace-nowrap text-sm text-gray-400 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Sugere nomes já usados em Clientes/Rotas/Orçamentos — se escrever um nome novo, cria a
                  ficha automaticamente. Atualiza também rotas e orçamentos antigos com esse nome.
                </p>
              )}
            </div>
            <div>
              <label className="label">Tipo de palete</label>
              <select
                className="input"
                value={tipoPaleteId}
                onChange={(e) => setTipoPaleteId(Number(e.target.value))}
              >
                {tiposPaleteAtivos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input
                type="number"
                min={1}
                className="input"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <button onClick={adicionarPedido} disabled={aGuardar} className="btn w-full">
                {aGuardar ? "A adicionar…" : "+ Adicionar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pedidos */}
      <div className="card">
        <h3 className="mb-1 font-semibold">Pedidos</h3>
        {detalhe.pedidos.length === 0 ? (
          <p className="text-sm text-gray-500">Ainda não há pedidos neste carregamento.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-400">
              A ordem de carga (nº) define-se arrastando as paletes na planta abaixo. Cada linha é um
              cliente + tipo de palete.
            </p>
            <div className="scroll-fade-x overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Nº</th>
                    <th className="th">Cliente</th>
                    <th className="th">Tipo de palete</th>
                    <th className="th">Qtd.</th>
                    <th className="th">Orientação</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detalhe.pedidos.map((p, i) => (
                    <tr key={p.id}>
                      <td className="td text-gray-400">{i + 1}</td>
                      <td className="td font-medium">{p.clienteNome}</td>
                      <td className="td">{p.tipoPaleteNome}</td>
                      <td className="td">{p.quantidade}</td>
                      <td className="td">
                        <select
                          className="input py-1 text-xs"
                          value={p.orientacao}
                          onChange={(e) =>
                            rodarPedido(p.id, e.target.value as "AUTO" | "COMPRIDO" | "TRAVES")
                          }
                        >
                          <option value="AUTO">Automática</option>
                          <option value="COMPRIDO">Ao comprido ↕</option>
                          <option value="TRAVES">Ao través ↔</option>
                        </select>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {p.quantidade >= 2 && (
                            <button
                              onClick={() => dividirPedido(p.id, p.quantidade)}
                              title="Dividir esta linha (para dar orientações diferentes)"
                              className="text-xs text-gray-500 hover:text-gray-800"
                            >
                              ✂ dividir
                            </button>
                          )}
                          <button
                            onClick={() => removerPedido(p.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Planta de carga */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Planta de carga</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={otimizar}
              disabled={aOtimizar || detalhe.pedidos.length < 2}
              className="btn-secondary text-sm"
            >
              {aOtimizar ? "A calcular…" : "⚡ Otimizar disposição"}
            </button>
            <DescarregarPdfBotao
              url={`/api/carregamentos/${detalhe.id}/planta-pdf`}
              nomeFicheiro={`planta-carga-${detalhe.veiculo.nome}-${new Date(detalhe.data).toISOString().slice(0, 10)}`}
              label="Imprimir planta de carga"
            />
          </div>
        </div>

        {simulacao && (
          <div className="mb-3 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
            {simulacao.jaOtima ? (
              <div className="flex items-center justify-between gap-3">
                <p>A disposição atual já aproveita o espaço da melhor forma possível.</p>
                <button
                  onClick={() => setSimulacao(null)}
                  className="whitespace-nowrap text-gray-500 hover:text-gray-800"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1 font-semibold">Ordem de carga sugerida:</p>
                <ol className="mb-2 list-decimal pl-5">
                  {simulacao.ordemSugerida
                    .filter(
                      (o, i, arr) => i === 0 || arr[i - 1].clienteNome !== o.clienteNome,
                    )
                    .map((o) => (
                      <li key={o.pedidoId}>{o.clienteNome}</li>
                    ))}
                </ol>
                <ul className="mb-3 space-y-0.5 text-gray-700">
                  {linhasGanho(simulacao.ganho).map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button onClick={aplicarOtimizacao} disabled={aOtimizar} className="btn text-sm">
                    Aplicar esta ordem
                  </button>
                  <button
                    onClick={() => setSimulacao(null)}
                    className="text-sm text-gray-500 hover:text-gray-800"
                  >
                    Ignorar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <CarregamentoFloorPlan
          caixas={detalhe.packing.caixas}
          ordemPedidoIds={detalhe.pedidos.map((p) => p.id)}
          onReordenar={moverPalete}
          onRodarPalete={rodarPalete}
          bloqueado={aReordenar}
        />
        <p className="mt-2 text-xs text-gray-400">
          Arrasta uma palete para a colocar noutro ponto da carga — as restantes reajustam-se
          sozinhas. O ↻ em cada palete roda só essa palete. A coluna &quot;Orientação&quot; na
          tabela define a orientação principal de uma linha inteira.
        </p>
      </div>

      {/* Não colocados */}
      {naoColocadosAgrupados.length > 0 && (
        <div className="card border-red-200">
          <h3 className="mb-2 font-semibold text-red-700">Sem espaço</h3>
          <div className="scroll-fade-x overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Cliente</th>
                  <th className="th">Tipo de palete</th>
                  <th className="th">Quantidade em falta</th>
                  <th className="th">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {naoColocadosAgrupados.map((n, i) => (
                  <tr key={i}>
                    <td className="td">{n.clienteNome}</td>
                    <td className="td">{n.tipoPaleteNome}</td>
                    <td className="td">{n.quantidade}</td>
                    <td className="td text-xs text-gray-500">
                      {n.motivo === "NAO_CABE_ORIENTACAO"
                        ? "Não cabe em nenhuma orientação nesta caixa"
                        : "Sem espaço livre"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quanto mais cabe */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Quantidade que ainda cabe (por tipo de palete)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {detalhe.estimativasRestantes.map((e) => (
            <div key={e.tipoPaleteId}>
              <p className="text-xs text-gray-500">{e.tipoPaleteNome}</p>
              <p className="text-lg font-bold">{e.quantosCabem}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
