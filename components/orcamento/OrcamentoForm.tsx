"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtEuro } from "@/lib/format";
import {
  totaisDevis,
  type LinhaDevis,
  type DetalheEstimativa,
} from "@/lib/calc/orcamento";
import { ROTULOS_TIPO_VEICULO, TIPOS_VEICULO } from "@/lib/validacao";
import DetalheLinha from "@/components/orcamento/DetalheLinha";
import MoradaInput from "@/components/orcamento/MoradaInput";

const TIPOS_PALETE = ["PALETE_120X80", "PALETE_120X100"] as const;
const ESTADOS = [
  ["RASCUNHO", "Rascunho"],
  ["ENVIADO", "Enviado"],
  ["ACEITE", "Aceite"],
  ["RECUSADO", "Recusado"],
] as const;

export interface DevisFull {
  id: number;
  numero: string;
  cliente: string;
  clienteEmail: string | null;
  clienteMorada: string | null;
  clienteContato: string | null;
  validade: string;
  estado: string;
  origemPadrao: string | null;
  observacoes: string | null;
  ivaPercent: number;
  linhas: LinhaDevis[];
}

interface ClienteOpt {
  nome: string;
  email: string | null;
  morada: string | null;
  contato: string | null;
}

interface Props {
  devis?: DevisFull;
  clientes: ClienteOpt[];
  veiculos: { id: number; nome: string }[];
  motoristas: { id: number; nome: string | null; codigo: string }[];
  /** Zonas de portagem já configuradas em Parâmetros (sugestões). */
  zonas: string[];
  /** Cliente pré-selecionado ao criar (ex.: vindo da ficha do cliente). */
  clienteInicial?: string;
}

/** Valor sentinela da opção "novo cliente" no dropdown. */
const CLIENTE_NOVO = "__novo__";

/** Linha + estado de UI (não persistido). */
type LinhaUI = LinhaDevis & {
  kmManual: boolean;
  aCalcular: boolean;
  aviso?: string;
  detalhe?: DetalheEstimativa;
};

function linhaVazia(origem: string, destino: string): LinhaUI {
  return {
    descricao: "",
    origem,
    destino,
    kmAuto: null,
    idaVolta: true,
    km: 0,
    pesoKg: 0,
    tipoVeiculo: "CAMIAO",
    nPaletes: 0,
    zonaPortagem: null,
    noitesFora: 0,
    alimentacao: 0,
    custoEstimado: 0,
    preco: 0,
    kmManual: false,
    aCalcular: false,
  };
}

export default function OrcamentoForm({
  devis,
  clientes,
  veiculos,
  motoristas,
  zonas,
  clienteInicial,
}: Props) {
  const router = useRouter();
  const editar = !!devis;

  // Em criação com cliente pré-selecionado, herda os contactos da ficha do cliente.
  const cInit = !devis && clienteInicial ? clientes.find((c) => c.nome === clienteInicial) : undefined;

  const clienteInicialNome = devis?.cliente ?? clienteInicial ?? "";
  const [cliente, setCliente] = useState(clienteInicialNome);
  const [clienteEmail, setClienteEmail] = useState(devis?.clienteEmail ?? cInit?.email ?? "");
  const [clienteContato, setClienteContato] = useState(
    devis?.clienteContato ?? cInit?.contato ?? "",
  );
  const [clienteMorada, setClienteMorada] = useState(devis?.clienteMorada ?? cInit?.morada ?? "");
  // Modo "novo cliente" (texto livre) em vez do dropdown: sem clientes cadastrados,
  // ou o nome atual não corresponde a nenhum da lista (não perder o valor gravado).
  const [clienteNovoModo, setClienteNovoModo] = useState(
    () =>
      clientes.length === 0 ||
      (!!clienteInicialNome && !clientes.some((c) => c.nome === clienteInicialNome)),
  );
  const [origemPadrao, setOrigemPadrao] = useState(devis?.origemPadrao ?? "");
  const [validade, setValidade] = useState(devis?.validade ?? "");
  const [estado, setEstado] = useState(devis?.estado ?? "RASCUNHO");
  const [ivaPercent, setIvaPercent] = useState(devis?.ivaPercent ?? 23);
  const [observacoes, setObservacoes] = useState(devis?.observacoes ?? "");
  const [linhas, setLinhas] = useState<LinhaUI[]>(
    (devis?.linhas ?? []).map((l) => ({
      ...l,
      noitesFora: l.noitesFora ?? 0,
      alimentacao: l.alimentacao ?? 0,
      kmManual: false,
      aCalcular: false,
    })),
  );
  // Motorista/veículo usados só para a ESTIMATIVA (não ficam no orçamento).
  const [motoristaId, setMotoristaId] = useState<number | null>(null);
  const [veiculoId, setVeiculoId] = useState<number | null>(null);
  const [aGravar, setAGravar] = useState(false);

  const totais = useMemo(() => totaisDevis(linhas, ivaPercent), [linhas, ivaPercent]);

  function escolherCliente(nome: string) {
    setCliente(nome);
    const c = clientes.find((x) => x.nome === nome);
    if (c) {
      setClienteEmail(c.email ?? "");
      setClienteContato(c.contato ?? "");
      setClienteMorada(c.morada ?? "");
    }
  }

  function patchLinha(i: number, patch: Partial<LinhaUI>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((ls) => [...ls, linhaVazia(origemPadrao, clienteMorada)]);
  }

  function removerLinha(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function calcularLinha(i: number) {
    const l = linhas[i];
    patchLinha(i, { aCalcular: true, aviso: undefined });
    try {
      const res = await fetch("/api/devis/estimar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origem: l.origem || origemPadrao,
          destino: l.destino,
          idaVolta: l.idaVolta,
          pesoKg: l.pesoKg,
          tipoVeiculo: l.tipoVeiculo,
          nPaletes: l.nPaletes,
          zonaPortagem: l.zonaPortagem,
          noitesFora: l.noitesFora,
          alimentacao: l.alimentacao,
          motoristaId,
          veiculoId,
          kmManual: l.kmManual ? l.km : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patchLinha(i, { aviso: data.erro || "Erro no cálculo." });
        return;
      }
      patchLinha(i, {
        kmAuto: data.kmAuto ?? null,
        km: data.km ?? l.km,
        custoEstimado: data.custoEstimado ?? 0,
        preco: data.precoSugerido ?? 0,
        detalhe: data.detalhe,
        aviso: data.aviso,
      });
    } catch {
      patchLinha(i, { aviso: "Erro de ligação." });
    } finally {
      patchLinha(i, { aCalcular: false });
    }
  }

  async function guardar() {
    if (!cliente.trim()) {
      alert("Indique o cliente.");
      return;
    }
    setAGravar(true);
    try {
      const payload = {
        cliente: cliente.trim(),
        clienteEmail: clienteEmail || null,
        clienteContato: clienteContato || null,
        clienteMorada: clienteMorada || null,
        origemPadrao: origemPadrao || null,
        validade: validade || null,
        estado,
        ivaPercent,
        observacoes: observacoes || null,
        linhas: linhas.map((l) => ({
          descricao: l.descricao,
          origem: l.origem,
          destino: l.destino,
          kmAuto: l.kmAuto,
          idaVolta: l.idaVolta,
          km: l.km,
          pesoKg: l.pesoKg,
          tipoVeiculo: l.tipoVeiculo,
          nPaletes: l.nPaletes,
          zonaPortagem: l.zonaPortagem,
          noitesFora: l.noitesFora,
          alimentacao: l.alimentacao,
          custoEstimado: l.custoEstimado,
          preco: l.preco,
        })),
      };
      const res = await fetch(editar ? `/api/devis/${devis!.id}` : "/api/devis", {
        method: editar ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.erro || "Erro ao guardar.");
        return;
      }
      if (editar) {
        router.refresh();
        alert("Orçamento guardado.");
      } else {
        router.push(`/escritorio/orcamentos/${data.devis.id}`);
      }
    } catch {
      alert("Erro de ligação.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cliente + cabeçalho */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Cliente e condições</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Cliente *</label>
            {clienteNovoModo ? (
              <div className="flex gap-2">
                <input
                  className="input"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do novo cliente"
                  autoFocus
                />
                {clientes.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary whitespace-nowrap"
                    onClick={() => {
                      setClienteNovoModo(false);
                      setCliente("");
                    }}
                  >
                    ← Existente
                  </button>
                )}
              </div>
            ) : (
              <select
                className="input"
                value={cliente}
                onChange={(e) => {
                  if (e.target.value === CLIENTE_NOVO) {
                    setClienteNovoModo(true);
                    setCliente("");
                  } else {
                    escolherCliente(e.target.value);
                  }
                }}
              >
                <option value="" disabled>
                  Selecionar cliente…
                </option>
                {clientes.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
                <option value={CLIENTE_NOVO}>➕ Novo cliente…</option>
              </select>
            )}
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contacto (pessoa)</label>
            <input
              className="input"
              value={clienteContato}
              onChange={(e) => setClienteContato(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Morada do cliente</label>
            <input
              className="input"
              value={clienteMorada}
              onChange={(e) => setClienteMorada(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Morada de partida por defeito (armazém)</label>
            <MoradaInput
              value={origemPadrao}
              onChange={setOrigemPadrao}
              placeholder="Ex.: Rua X, Lisboa"
            />
          </div>
          <div>
            <label className="label">Válido até</label>
            <input
              className="input"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map(([v, lbl]) => (
                <option key={v} value={v}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Parâmetros de estimativa (motorista/veículo) */}
        <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 md:grid-cols-3">
          <div>
            <label className="label">Motorista (para estimar)</label>
            <select
              className="input"
              value={motoristaId ?? ""}
              onChange={(e) => setMotoristaId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Parâmetros globais</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || m.codigo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Veículo (para estimar)</label>
            <select
              className="input"
              value={veiculoId ?? ""}
              onChange={(e) => setVeiculoId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Parâmetros globais</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">IVA (%)</label>
            <input
              className="input"
              type="number"
              value={ivaPercent}
              onChange={(e) => setIvaPercent(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Linhas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Linhas do orçamento</h2>
          <button className="btn-secondary" onClick={adicionarLinha} type="button">
            + Adicionar linha
          </button>
        </div>

        <datalist id="lista-zonas-orcamento">
          {zonas.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>

        {linhas.length === 0 && (
          <div className="card text-sm text-gray-400">
            Sem linhas. Adicione um transporte para estimar o preço.
          </div>
        )}

        {linhas.map((l, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Linha {i + 1}</span>
              <button
                type="button"
                onClick={() => removerLinha(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>

            <div>
              <label className="label">Descrição</label>
              <input
                className="input"
                value={l.descricao}
                onChange={(e) => patchLinha(i, { descricao: e.target.value })}
                placeholder="Ex.: Transporte de paletes"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="label">Origem</label>
                <MoradaInput
                  value={l.origem}
                  onChange={(v) => patchLinha(i, { origem: v })}
                  placeholder={origemPadrao || "Morada de partida"}
                />
              </div>
              <div>
                <label className="label">Destino</label>
                <MoradaInput
                  value={l.destino}
                  onChange={(v) => patchLinha(i, { destino: v })}
                  placeholder="Morada do cliente"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className="label">Tipo de veículo</label>
                <select
                  className="input"
                  value={l.tipoVeiculo}
                  onChange={(e) => {
                    const v = e.target.value;
                    const eDePalete = (TIPOS_PALETE as readonly string[]).includes(v);
                    patchLinha(i, { tipoVeiculo: v, nPaletes: eDePalete ? l.nPaletes : 0 });
                  }}
                >
                  {TIPOS_VEICULO.map((t) => (
                    <option key={t} value={t}>
                      {ROTULOS_TIPO_VEICULO[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              {(TIPOS_PALETE as readonly string[]).includes(l.tipoVeiculo) ? (
                <div>
                  <label className="label">Nº de paletes</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    value={l.nPaletes}
                    onChange={(e) => patchLinha(i, { nPaletes: Number(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Peso (kg)</label>
                  <input
                    className="input"
                    type="number"
                    value={l.pesoKg}
                    onChange={(e) => patchLinha(i, { pesoKg: Number(e.target.value) || 0 })}
                  />
                </div>
              )}
              <div>
                <label className="label">Zona portagem</label>
                <input
                  className="input"
                  list="lista-zonas-orcamento"
                  value={l.zonaPortagem ?? ""}
                  onChange={(e) => patchLinha(i, { zonaPortagem: e.target.value || null })}
                  placeholder="(opcional)"
                />
              </div>
              <div>
                <label className="label">Km {l.kmManual ? "(manual)" : "(auto)"}</label>
                <input
                  className="input"
                  type="number"
                  value={l.km}
                  onChange={(e) =>
                    patchLinha(i, { km: Number(e.target.value) || 0, kmManual: true })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Noites fora (nº)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={l.noitesFora ?? 0}
                  onChange={(e) => patchLinha(i, { noitesFora: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Alimentação (€)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={l.alimentacao ?? 0}
                  onChange={(e) => patchLinha(i, { alimentacao: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={l.idaVolta}
                  onChange={(e) => patchLinha(i, { idaVolta: e.target.checked })}
                />
                Ida e volta (regresso a vazio)
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => calcularLinha(i)}
                disabled={l.aCalcular}
              >
                {l.aCalcular ? "A calcular…" : "Calcular"}
              </button>
              {l.kmAuto != null && (
                <span className="text-xs text-gray-500">
                  Distância (ida): {l.kmAuto} km
                </span>
              )}
            </div>

            {l.aviso && <p className="text-xs text-amber-600">{l.aviso}</p>}

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 md:grid-cols-2">
              <div>
                <label className="label">Custo estimado</label>
                <p className="text-sm font-medium text-gray-700">
                  {fmtEuro(l.custoEstimado)}
                </p>
              </div>
              <div>
                <label className="label">Preço ao cliente (€)</label>
                <input
                  className="input"
                  type="number"
                  value={l.preco}
                  onChange={(e) => patchLinha(i, { preco: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            {l.detalhe && (
              <DetalheLinha
                detalhe={l.detalhe}
                custoEstimado={l.custoEstimado}
                preco={l.preco}
              />
            )}
          </div>
        ))}
      </div>

      {/* Observações + totais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <label className="label">Observações</label>
          <textarea
            className="input"
            rows={5}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Condições, prazos, notas para o cliente…"
          />
        </div>
        <div className="card space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{fmtEuro(totais.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">IVA ({ivaPercent}%)</span>
            <span className="font-medium">{fmtEuro(totais.ivaValor)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{fmtEuro(totais.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn" onClick={guardar} disabled={aGravar}>
          {aGravar ? "A guardar…" : editar ? "Guardar alterações" : "Criar orçamento"}
        </button>
      </div>
    </div>
  );
}
