"use client";

import { useMemo, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const MAX_SUGESTOES = 8;
/** Sem filtro (campo vazio ou já com uma opção escolhida) mostra-se a lista toda, com scroll. */
const MAX_SEM_FILTRO = 60;

/** O texto é exatamente uma das opções (ex.: uma zona de portagem já escolhida). */
export function valorEhOpcao(value: string, opcoes: string[]): boolean {
  const v = value.trim().toLowerCase();
  return v !== "" && opcoes.some((o) => o.toLowerCase() === v);
}

/**
 * Sugestões para o texto atual. Quando o campo já tem uma opção escolhida, mostra
 * TODAS as opções (em vez de só a escolhida, que era o que o filtro dava) — para
 * trocar por engano sem ter de apagar o texto à mão.
 */
export function sugestoes(value: string, opcoes: string[]): string[] {
  const termo = value.trim().toLowerCase();
  if (!termo || valorEhOpcao(value, opcoes)) return opcoes.slice(0, MAX_SEM_FILTRO);
  return opcoes.filter((o) => o.toLowerCase().includes(termo)).slice(0, MAX_SUGESTOES);
}

/**
 * Substitui `<input list>` + `<datalist>`: no Chrome Android o popup nativo do
 * datalist renderiza no tema escuro do sistema (independente do tema claro da
 * app) e, em alguns telemóveis, perde o fundo sólido a meio da escrita,
 * ficando transparente por cima da página. Esta versão é só nosso HTML/CSS —
 * fundo sempre claro e sólido, sem depender do popup nativo do browser.
 */
export default function Autocomplete({ value, onChange, opcoes, placeholder, autoFocus, className }: Props) {
  const [aberto, setAberto] = useState(false);

  const filtradas = useMemo(() => sugestoes(value, opcoes), [value, opcoes]);
  const inputRef = useRef<HTMLInputElement>(null);

  function escolher(v: string) {
    onChange(v);
    setAberto(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={`${className ?? "input"} ${value ? "pr-9" : ""}`}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={(e) => {
          setAberto(true);
          // Opção já escolhida: seleciona o texto, para escrever por cima substituir.
          if (valorEhOpcao(value, opcoes)) e.currentTarget.select();
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar"
          title="Limpar"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            setAberto(true);
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ×
        </button>
      )}
      {aberto && filtradas.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtradas.map((op) => (
            <li key={op}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(op)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                {op}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
