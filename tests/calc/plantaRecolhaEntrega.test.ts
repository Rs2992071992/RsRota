import { describe, it, expect } from "vitest";
import { gerarPlantaCargaPorTroco, verificarEspacoCarga, type ParagemCarga } from "@/lib/calc/cargaRota";
import type { CaixaInput } from "@/lib/calc/paletePacking";

const CAMIAO: CaixaInput = { id: "veiculo", label: "AO-33-PJ", comprimentoMm: 7500, larguraMm: 2480 };

const L = (n: number, c: number, l: number, nome: string) => ({ tipoPaleteId: 1, comprimentoMm: c, larguraMm: l, nPaletes: n, clienteNome: nome });

/** Rota real RIC-Tec-A210: Tec-A2 entrega na Ida, depois recolhe e volta a entregar no fim. */
function rotaA210(): ParagemCarga[] {
  return [
    { id: 412, cliente: "Tec-A2", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 382560, entregues: [L(4, 1150, 1150, "Tec-A2")], recolhidas: [] },
    { id: 413, cliente: "Plas-DisRivas", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 382713, entregues: [L(6, 1200, 800, "Plas-DisRivas")], recolhidas: [] },
    { id: 414, cliente: "Tec-All Ways cargo", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 382894, entregues: [L(3, 1100, 900, "Tec-All Ways cargo")], recolhidas: [] },
    { id: 415, cliente: "Vazio", tipoViagem: "Volta", tipoVeiculo: "VAZIO", kmInicial: 383024, entregues: [], recolhidas: [] },
    { id: 416, cliente: "Tec-A2", tipoViagem: "Volta", tipoVeiculo: "CAMIAO", kmInicial: 383096, entregues: [], recolhidas: [L(3, 1300, 1100, "Tec-A2"), L(1, 1200, 800, "Tec-A2")] },
    { id: 417, cliente: "Tec-A2", tipoViagem: "Volta", tipoVeiculo: "CAMIAO", kmInicial: 383096, entregues: [L(3, 1300, 1100, "Tec-A2"), L(1, 1200, 800, "Tec-A2")], recolhidas: [] },
  ];
}

describe("planta: cliente que entrega na Ida, recolhe e volta a entregar (RIC-Tec-A210)", () => {
  it("a Ida mostra TODAS as paletes que vão a bordo (inclui as 4 da Tec-A2)", () => {
    const { ida } = gerarPlantaCargaPorTroco([CAMIAO], null, rotaA210());
    const itens = ida!.caixas.flatMap((c) => c.itens);
    expect(itens).toHaveLength(13); // 4 Tec-A2 + 6 Plas-DisRivas + 3 Tec-All Ways
    expect(itens.filter((i) => i.clienteNome === "Tec-A2")).toHaveLength(4);
  });

  it("a Volta mostra a recolha a bordo (4 paletes) até à entrega final", () => {
    const { volta } = gerarPlantaCargaPorTroco([CAMIAO], null, rotaA210());
    const itens = volta!.caixas.flatMap((c) => c.itens);
    expect(itens).toHaveLength(4);
    expect(itens.every((i) => i.clienteNome === "Tec-A2")).toBe(true);
  });

  it("cabe tudo", () => {
    expect(verificarEspacoCarga([CAMIAO], null, rotaA210()).cabemTodas).toBe(true);
  });

  it("duas recolhas do mesmo cliente a seguir à mesma entrega continuam a fechar nela", () => {
    const rota: ParagemCarga[] = [
      { id: 1, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 0, entregues: [L(2, 1200, 800, "X")], recolhidas: [] },
      { id: 2, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 10, entregues: [], recolhidas: [L(3, 1200, 800, "X")] },
      { id: 3, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 20, entregues: [], recolhidas: [L(4, 1200, 800, "X")] },
      { id: 4, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 30, entregues: [L(7, 1200, 800, "X")], recolhidas: [] },
    ];
    // Pior momento = 2 (entrega inicial já entregue?) não: chegada à paragem 4 com 3+4 recolhidas = 7.
    const { ida } = gerarPlantaCargaPorTroco([CAMIAO], null, rota);
    expect(ida!.caixas.flatMap((c) => c.itens).length).toBe(7);
  });

  it("recolha sem nenhuma entrega depois dela fica a bordo até ao fim (recolha normal)", () => {
    const rota: ParagemCarga[] = [
      { id: 1, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 0, entregues: [L(2, 1200, 800, "X")], recolhidas: [] },
      { id: 2, cliente: "X", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 10, entregues: [], recolhidas: [L(3, 1200, 800, "X")] },
    ];
    const { ida } = gerarPlantaCargaPorTroco([CAMIAO], null, rota);
    // Estados: antes da paragem 1: 2 (entrega) ; antes da 2: 2 ; no fim: 3 (recolha). Pior = 3.
    expect(ida!.caixas.flatMap((c) => c.itens).length).toBe(3);
  });
});

describe("trecho VAZIO: o camião segue sem carga, não gera 'sem espaço' falso (RIC-A23)", () => {
  const REBOQUE: CaixaInput = { id: "reboque", label: "Lecitrailer", comprimentoMm: 8150, larguraMm: 2480 };
  const e = (id: number, n: number, c: number, l: number, km: number, tipo: string): ParagemCarga => ({
    id, cliente: `C${id}`, tipoViagem: "Ida", tipoVeiculo: tipo, kmInicial: km,
    entregues: n > 0 ? [L(n, c, l, `C${id}`)] : [], recolhidas: [],
  });
  const rota = [
    e(1, 20, 1300, 1100, 0, "CAMIAO+REBOQUE"),
    e(2, 0, 0, 0, 100, "VAZIO"),
    e(3, 14, 1200, 800, 120, "CAMIAO+REBOQUE"),
    e(4, 15, 1300, 1100, 140, "CAMIAO+REBOQUE"),
  ];

  it("a rota inteira dá o mesmo aviso que o segmento carregado sozinho", () => {
    const sozinho = verificarEspacoCarga([CAMIAO], REBOQUE, [rota[2], rota[3]]);
    const inteira = verificarEspacoCarga([CAMIAO], REBOQUE, rota);
    expect(inteira.semEspaco).toBe(sozinho.semEspaco);
    expect(inteira.cabemTodas).toBe(sozinho.cabemTodas);
  });

  it("uma recolha ligada a uma entrega continua a atravessar o VAZIO", () => {
    const comLinha: ParagemCarga[] = [
      { id: 1, cliente: "A", tipoViagem: "Ida", tipoVeiculo: "CAMIAO", kmInicial: 0, entregues: [], recolhidas: [L(5, 1200, 800, "A")] },
      { id: 2, cliente: "Vazio", tipoViagem: "Ida", tipoVeiculo: "VAZIO", kmInicial: 50, entregues: [], recolhidas: [] },
      { id: 3, cliente: "A", tipoViagem: "Volta", tipoVeiculo: "CAMIAO", kmInicial: 90, entregues: [L(5, 1200, 800, "A")], recolhidas: [] },
    ];
    // No trecho vazio os 5 lotes ainda vão a bordo (linha recolha->entrega).
    const { ida } = gerarPlantaCargaPorTroco([CAMIAO], null, comLinha);
    expect(ida!.caixas.flatMap((c) => c.itens)).toHaveLength(5);
  });
});

describe("cadeia: recolhe, descarrega e volta a carregar no mesmo sítio, entrega no destino (RIC-Tec-absorvalor)", () => {
  const REB: CaixaInput = { id: "reboque", label: "Lecitrailer", comprimentoMm: 8150, larguraMm: 2480 };
  const p1300 = (n: number, nome: string) => L(n, 1300, 1100, nome);
  const rota = (faturarNaMista: string | null): ParagemCarga[] => [
    { id: 423, cliente: "Tec-absorvalor", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 383437, entregues: [], recolhidas: [p1300(22, "Tec-absorvalor")], faturarCliente: "Gesplast" },
    { id: 424, cliente: "Gesplast", tipoViagem: "Ida", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 383457, entregues: [p1300(22, "Gesplast")], recolhidas: [p1300(22, "Gesplast")], faturarCliente: faturarNaMista },
    { id: 425, cliente: "Ges-sacofilme", tipoViagem: "Volta", tipoVeiculo: "CAMIAO+REBOQUE", kmInicial: 383562, entregues: [p1300(22, "Ges-sacofilme")], recolhidas: [] },
    { id: 426, cliente: "Vazio", tipoViagem: "Ida", tipoVeiculo: "VAZIO", kmInicial: 383683, entregues: [], recolhidas: [] },
  ];

  it("com a recolha da Gesplast marcada para o destino final nunca vão mais de 22 a bordo", () => {
    const e = verificarEspacoCarga([CAMIAO], REB, rota("Ges-sacofilme"));
    expect(e.totalPaletes).toBe(22);
    expect(e.cabemTodas).toBe(true);
    const { ida, volta } = gerarPlantaCargaPorTroco([CAMIAO], REB, rota("Ges-sacofilme"));
    expect(ida!.caixas.flatMap((c) => c.itens)).toHaveLength(22);
    expect(volta!.caixas.flatMap((c) => c.itens)).toHaveLength(22);
  });

  it("sem marcar a recolha da Gesplast o motor não adivinha o destino (fica como está)", () => {
    expect(verificarEspacoCarga([CAMIAO], REB, rota(null)).totalPaletes).toBe(44);
  });
});
