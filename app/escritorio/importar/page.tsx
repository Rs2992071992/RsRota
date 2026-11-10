import ExportarBotoes from "./ExportarBotoes";
import ImportarCliente from "./ImportarCliente";

export default function ImportarPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Importar / Exportar</h1>

      <div className="card">
        <h2 className="mb-2 font-semibold">Exportar</h2>
        <p className="mb-3 text-sm text-gray-500">
          Descarrega as rotas e paragens calculadas.
        </p>
        <ExportarBotoes />
      </div>

      <ImportarCliente />
    </div>
  );
}
