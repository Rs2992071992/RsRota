"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Campo de morada com autocomplete (OpenRouteService). Escreve-se livremente e, a
 * partir de 3 letras, mostra sugestões de moradas completas para clicar. Continua a
 * permitir morada manual (o que estiver escrito é o valor).
 */
export default function MoradaInput({ value, onChange, placeholder }: Props) {
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const ignorarRef = useRef(false); // evita re-procurar logo após escolher uma sugestão
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ignorarRef.current) {
      ignorarRef.current = false;
      return;
    }
    const texto = value.trim();
    if (texto.length < 3) {
      setSugestoes([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/devis/geocode?q=${encodeURIComponent(texto)}`);
        if (!res.ok) return;
        const data = await res.json();
        const labels: string[] = (data.sugestoes ?? []).map(
          (s: { label: string }) => s.label,
        );
        setSugestoes(labels);
        setAberto(labels.length > 0);
      } catch {
        /* silencioso — a morada manual continua válida */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function escolher(label: string) {
    ignorarRef.current = true;
    onChange(label);
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        autoComplete="off"
      />
      {aberto && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {sugestoes.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
