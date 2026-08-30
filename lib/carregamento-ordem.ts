// Helper puro para reordenar manualmente os blocos de cliente na planta de
// carga (setas ↑/↓). Sem dependências de DB/framework — testável isoladamente.

export interface PedidoOrdenavel {
  pedidoId: number;
  clienteId: number;
}

/**
 * Move o bloco inteiro de um cliente uma posição para cima/baixo na sequência
 * de carga, mantendo as paletes de cada cliente sempre juntas. Devolve o novo
 * array de `pedidoId` na ordem resultante (para `PATCH .../pedidos/ordem`).
 *
 * A ordem dos clientes é a ordem em que cada um aparece pela 1ª vez em
 * `pedidos` (que já vem ordenado por `ordem`). Pedidos do mesmo cliente que
 * estejam dispersos são reagrupados no ponto da 1ª aparição.
 */
export function moverBlocoCliente(
  pedidos: PedidoOrdenavel[],
  clienteId: number,
  direcao: "cima" | "baixo",
): number[] {
  const ordemClientes: number[] = [];
  const blocos = new Map<number, number[]>();
  for (const p of pedidos) {
    if (!blocos.has(p.clienteId)) {
      blocos.set(p.clienteId, []);
      ordemClientes.push(p.clienteId);
    }
    blocos.get(p.clienteId)!.push(p.pedidoId);
  }

  const i = ordemClientes.indexOf(clienteId);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i !== -1 && j >= 0 && j < ordemClientes.length) {
    [ordemClientes[i], ordemClientes[j]] = [ordemClientes[j], ordemClientes[i]];
  }
  return ordemClientes.flatMap((cid) => blocos.get(cid)!);
}
