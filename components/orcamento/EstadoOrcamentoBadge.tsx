// Badge presentacional do estado de um orçamento. Sem hooks → usável em server e client.

const CORES: Record<string, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  ENVIADO: "bg-blue-100 text-blue-700",
  ACEITE: "bg-green-100 text-green-700",
  RECUSADO: "bg-red-100 text-red-700",
};

const ROTULOS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  ACEITE: "Aceite",
  RECUSADO: "Recusado",
};

export default function EstadoOrcamentoBadge({ estado }: { estado: string }) {
  const cor = CORES[estado] ?? CORES.RASCUNHO;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}>
      {ROTULOS[estado] ?? estado}
    </span>
  );
}
