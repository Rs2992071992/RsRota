"use client";

import { useMemo, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const MAX_SUGESTOES = 8;

/**
 * Substitui `<input list>` + `<datalist>`: no Chrome Android o popup nativo do
 * datalist renderiza no tema escuro do sistema (independente do tema claro da
 * app) e, em alguns telemóveis, perde o fundo sólido a meio da escrita,
 * ficando transparente por cima da página. Esta versão é só nosso HTML/CSS —
 * fundo sempre claro e sólido, sem depender do popup nativo do browser.
 */
export default function Autocomplete({ value, onChange, opcoes, placeholder, autoFocus, className }: Props) {
  const [aberto, setAberto] = useState(false);

  const filtradas = useMemo(() => {
    const termo = value.trim().toLowerCase();
    const lista = termo ? opcoes.filter((o) => o.toLowerCase().includes(termo)) : opcoes;
    return lista.slice(0, MAX_SUGESTOES);
  }, [value, opcoes]);

  function escolher(v: string) {
    onChange(v);
    setAberto(false);
  }

  return (
    <div className="relative">
      <input
        className={className ?? "input"}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
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
