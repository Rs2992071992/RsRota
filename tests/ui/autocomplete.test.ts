import { describe, it, expect } from "vitest";
import { sugestoes, valorEhOpcao } from "@/components/Autocomplete";

const ZONAS = ["Zona Norte", "Zona Sul", "Lisboa", "Porto", "Algarve", "Madrid", "Zona Centro", "Braga", "Faro", "Évora"];

describe("Autocomplete — sugestões", () => {
  it("campo vazio mostra todas as opções (com scroll)", () => {
    expect(sugestoes("", ZONAS)).toEqual(ZONAS);
  });

  it("a escrever filtra pelo texto (máx. 8)", () => {
    expect(sugestoes("zona", ZONAS)).toEqual(["Zona Norte", "Zona Sul", "Zona Centro"]);
    const muitas = Array.from({ length: 30 }, (_, i) => `Zona ${i}`);
    expect(sugestoes("zona", muitas)).toHaveLength(8);
  });

  it("com uma opção JÁ ESCOLHIDA mostra TODAS (para trocar sem apagar o texto)", () => {
    // Antes só devolvia ["Zona Sul"] — era preciso apagar tudo à mão para ver as outras.
    expect(sugestoes("Zona Sul", ZONAS)).toEqual(ZONAS);
    expect(sugestoes("  zona sul ", ZONAS)).toEqual(ZONAS); // ignora maiúsculas/espaços
  });

  it("texto parcial que não é uma opção continua a filtrar", () => {
    expect(sugestoes("zona s", ZONAS)).toEqual(["Zona Sul"]);
    expect(sugestoes("xyz", ZONAS)).toEqual([]);
  });

  it("valorEhOpcao", () => {
    expect(valorEhOpcao("Porto", ZONAS)).toBe(true);
    expect(valorEhOpcao("porto", ZONAS)).toBe(true);
    expect(valorEhOpcao("Port", ZONAS)).toBe(false);
    expect(valorEhOpcao("", ZONAS)).toBe(false);
  });
});
