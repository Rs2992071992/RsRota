"use client";

import { useState } from "react";

type Operador = "+" | "−" | "×" | "÷";

function aplicar(a: number, b: number, op: Operador): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b !== 0 ? a / b : 0;
  }
}

/**
 * Calculadora simples flutuante, disponível em todas as páginas do motorista
 * e do escritório. Estado local, sem dependências.
 */
export default function Calculadora() {
  const [aberta, setAberta] = useState(false);
  const [visor, setVisor] = useState("0");
  const [anterior, setAnterior] = useState<number | null>(null);
  const [operador, setOperador] = useState<Operador | null>(null);
  const [resetProximo, setResetProximo] = useState(false);

  function digito(d: string) {
    if (resetProximo) {
      setVisor(d);
      setResetProximo(false);
      return;
    }
    setVisor((v) => (v === "0" ? d : v.length < 15 ? v + d : v));
  }

  function ponto() {
    if (resetProximo) {
      setVisor("0.");
      setResetProximo(false);
      return;
    }
    setVisor((v) => (v.includes(".") ? v : v + "."));
  }

  function limpar() {
    setVisor("0");
    setAnterior(null);
    setOperador(null);
    setResetProximo(false);
  }

  function percentagem() {
    setVisor((v) => String(Number(v) / 100));
  }

  function escolherOperador(op: Operador) {
    const atual = Number(visor);
    if (anterior != null && operador && !resetProximo) {
      setAnterior(aplicar(anterior, atual, operador));
    } else {
      setAnterior(atual);
    }
    setOperador(op);
    setResetProximo(true);
  }

  function igual() {
    if (anterior == null || !operador) return;
    const resultado = aplicar(anterior, Number(visor), operador);
    setVisor(String(resultado));
    setAnterior(null);
    setOperador(null);
    setResetProximo(true);
  }

  const teclas: (string | { label: string; fn: () => void; classe?: string })[] = [
    { label: "C", fn: limpar, classe: "text-red-600" },
    { label: "%", fn: percentagem },
    { label: "÷", fn: () => escolherOperador("÷"), classe: "text-brand" },
    { label: "×", fn: () => escolherOperador("×"), classe: "text-brand" },
    "7",
    "8",
    "9",
    { label: "−", fn: () => escolherOperador("−"), classe: "text-brand" },
    "4",
    "5",
    "6",
    { label: "+", fn: () => escolherOperador("+"), classe: "text-brand" },
    "1",
    "2",
    "3",
    { label: "=", fn: igual, classe: "bg-brand text-white row-span-1" },
    { label: "0", fn: () => digito("0"), classe: "col-span-2" },
    { label: ".", fn: ponto },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-label="Calculadora"
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-xl text-white shadow-lg hover:opacity-90"
      >
        🧮
      </button>

      {aberta && (
        <div className="fixed bottom-20 right-4 z-50 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Calculadora</span>
            <button
              type="button"
              onClick={() => setAberta(false)}
              aria-label="Fechar"
              className="text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <div className="mb-2 overflow-x-auto rounded-md bg-gray-100 px-3 py-2 text-right text-xl font-semibold">
            {visor}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {teclas.map((t, i) =>
              typeof t === "string" ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => digito(t)}
                  className="rounded-md bg-gray-50 py-2 text-sm font-medium hover:bg-gray-200"
                >
                  {t}
                </button>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={t.fn}
                  className={`rounded-md bg-gray-50 py-2 text-sm font-semibold hover:bg-gray-200 ${t.classe ?? ""}`}
                >
                  {t.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}
