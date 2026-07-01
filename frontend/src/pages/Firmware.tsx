import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface Programacion {
  id: number;
  version: string;
  archivoNombre: string;
  estado: "EN_COLA" | "EN_PRUEBA" | "APROBADO" | "RECHAZADO";
  cruce: { codigo: string; ubicacion: string };
  subidoPor: { nombre: string };
  feedbacks: { id: number; comentario: string; aprobado: boolean }[];
}

const BADGE: Record<string, string> = {
  APROBADO: "bg-emerald-500/15 text-emerald-400",
  RECHAZADO: "bg-red-500/15 text-red-400",
  EN_PRUEBA: "bg-violet-500/15 text-violet-400",
  EN_COLA: "bg-neutral-700/50 text-neutral-300",
};

export default function Firmware() {
  const [programaciones, setProgramaciones] = useState<Programacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Programacion[]>("/firmware/programaciones")
      .then(setProgramaciones)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!programaciones) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">
        Historial y Feedback de Banco de Pruebas
      </h2>
      <div className="space-y-3">
        {programaciones.map((f) => (
          <div key={f.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-mono font-semibold text-neutral-200">{f.archivoNombre}</p>
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
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    : "bg-red-500/10 text-red-300 border-red-500/20"
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
