// Skeleton genérico para vistas de tabla/listado mientras carga la API.
export default function CargandoTabla() {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 animate-pulse" aria-label="Cargando…">
      <div className="h-4 w-64 rounded bg-neutral-200 mb-2" />
      <div className="h-3 w-96 rounded bg-neutral-100 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 rounded-lg bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}
