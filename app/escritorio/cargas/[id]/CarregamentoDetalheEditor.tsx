"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CarregamentoDetalhe } from "@/lib/carregamento-service";
import CarregamentoFloorPlan from "@/components/CarregamentoFloorPlan";

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
    router.refresh();
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
        <h3 className="mb-3 font-semibold">Pedidos</h3>
        {detalhe.pedidos.length === 0 ? (
          <p className="text-sm text-gray-500">Ainda não há pedidos neste carregamento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Cliente</th>
                  <th className="th">Tipo de palete</th>
                  <th className="th">Quantidade</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {detalhe.pedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="td">{p.clienteNome}</td>
                    <td className="td">{p.tipoPaleteNome}</td>
                    <td className="td">{p.quantidade}</td>
                    <td className="td">
                      <button onClick={() => removerPedido(p.id)} className="text-red-500 hover:text-red-700">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Planta de carga */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Planta de carga</h3>
        <CarregamentoFloorPlan caixas={detalhe.packing.caixas} />
      </div>

      {/* Não colocados */}
      {naoColocadosAgrupados.length > 0 && (
        <div className="card border-red-200">
          <h3 className="mb-2 font-semibold text-red-700">Sem espaço</h3>
          <div className="overflow-x-auto">
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
        <h3 className="mb-3 font-semibold">Quanto mais cabe (por tipo de palete)</h3>
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
