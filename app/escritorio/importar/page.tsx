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
        <div className="flex gap-2">
          <a href="/api/exportar?formato=xlsx" className="btn">
            Exportar Excel
          </a>
          <a href="/api/exportar?formato=csv" className="btn-secondary">
            Exportar CSV (rotas)
          </a>
        </div>
      </div>

      <ImportarCliente />
    </div>
  );
}
