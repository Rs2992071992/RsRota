"use client";

import { useEffect } from "react";

/**
 * Ao focar (clique/tab) num <input type="number">, seleciona o valor atual
 * para que escrever substitua o "0" em vez de ficar colado à frente dele.
 * Aplicado globalmente (focusin no document) para cobrir todos os
 * formulários sem repetir onFocus em cada campo.
 */
export default function SelecaoCamposNumericos() {
  useEffect(() => {
    function aoFocar(e: FocusEvent) {
      const alvo = e.target;
      if (alvo instanceof HTMLInputElement && alvo.type === "number") {
        try {
          alvo.select();
        } catch {
          // Alguns motores não suportam seleção em type="number"; ignora.
        }
      }
    }
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, []);

  return null;
}
