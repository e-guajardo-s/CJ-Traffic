import type { Programacion } from "./types";

const BADGE: Record<string, string> = {
  APROBADO: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  RECHAZADO: "bg-red-50 text-red-700 border border-red-200",
  EN_PRUEBA: "bg-violet-50 text-violet-700 border border-violet-200",
  EN_COLA: "bg-neutral-100 text-neutral-600 border border-neutral-200",
};

export default function FirmwareHistorial({ programaciones }: { programaciones: Programacion[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
        Historial y Feedback de Banco de Pruebas
      </h2>
      <div className="space-y-3">
        {programaciones.map((f) => (
          <div key={f.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-mono font-semibold text-neutral-700">{f.archivoNombre}</p>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${BADGE[f.estado]}`}>
                {f.estado.replace("_", " ")}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              {f.cruce.codigo} · {f.cruce.ubicacion} · {f.version} · subido por {f.subidoPor.nombre}
            </p>
            {f.feedbacks.map((fb) => (
              <p
                key={fb.id}
                className={`text-xs mt-2 px-3 py-2 rounded-lg border ${
                  fb.aprobado
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {fb.comentario}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
