// Helper puro para reordenar a sequência de carga arrastando uma linha de
// pedido para cima de outra na planta. Sem dependências de DB/framework —
// testável isoladamente.

/**
 * Move `arrastado` para imediatamente antes/depois de `alvo` na sequência.
 * `ordemAtual` é a lista de `pedidoId` na ordem atual; devolve a nova lista
 * (para `PATCH /api/carregamentos/[id]/pedidos/ordem`).
 *
 * No-op (devolve `ordemAtual` tal como está) se `arrastado === alvo`, ou se
 * `alvo`/`arrastado` não estiverem na lista.
 */
export function reordenarArrastando(
  ordemAtual: number[],
  arrastado: number,
  alvo: number,
  posicao: "antes" | "depois",
): number[] {
  if (
    arrastado === alvo ||
    !ordemAtual.includes(arrastado) ||
    !ordemAtual.includes(alvo)
  ) {
    return ordemAtual;
  }
  const semArrastado = ordemAtual.filter((id) => id !== arrastado);
  const iAlvo = semArrastado.indexOf(alvo);
  const at = posicao === "antes" ? iAlvo : iAlvo + 1;
  return [...semArrastado.slice(0, at), arrastado, ...semArrastado.slice(at)];
}
