const ENSE_URL = "https://www.ense-epe.pt/precos-de-referencia/";

/**
 * Ligação discreta (flutuante, ao lado da Calculadora) para os preços de
 * referência de combustíveis da ENSE — útil ao motorista quando precisa do
 * valor para preencher uma guia. Não interfere com o cabeçalho (ver lições
 * de 2026-08-12 sobre overflow a 320px ao acrescentar itens à nav).
 */
export default function LinkPrecoReferencia() {
  return (
    <a
      href={ENSE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Preços de referência de combustíveis (ENSE)"
      title="Preços de referência de combustíveis (ENSE)"
      className="fixed bottom-4 right-20 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-gray-500 shadow-lg hover:border-brand hover:text-brand"
    >
      ⛽
    </a>
  );
}
