import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface Cruce {
  id: number;
  codigo: string;
  ubicacion: string;
  controlador: string;
  gateway: {
    modelo: string;
    simApn: string;
    estado: "ONLINE" | "OFFLINE" | "DEGRADADO";
  } | null;
}

const DOT: Record<string, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-red-500",
  DEGRADADO: "bg-amber-500",
};
const TEXT: Record<string, string> = {
  ONLINE: "text-emerald-400",
  OFFLINE: "text-red-400",
  DEGRADADO: "text-amber-400",
};

export default function Iot() {
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Cruce[]>("/iot/gateways")
      .then(setCruces)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!cruces) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-1">
        Mantenedor — Directorio de Telemetría IoT
      </h2>
      <p className="text-xs text-neutral-500 mb-5">
        Cruce semafórico ↔ Controlador ↔ Gateway de telemetría. Administrado por Desarrollo Tecnológico.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
              <th className="py-3 pr-4">ID Cruce</th>
              <th className="py-3 pr-4">Ubicación</th>
              <th className="py-3 pr-4">Controlador</th>
              <th className="py-3 pr-4">Gateway</th>
              <th className="py-3 pr-4">SIM / APN</th>
              <th className="py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70">
            {cruces.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-800/30">
                <td className="py-3 pr-4 font-mono font-bold text-amber-400">{c.codigo}</td>
                <td className="py-3 pr-4 text-neutral-200">{c.ubicacion}</td>
                <td className="py-3 pr-4">{c.controlador}</td>
                <td className="py-3 pr-4 font-mono text-violet-300">{c.gateway?.modelo ?? "—"}</td>
                <td className="py-3 pr-4 text-neutral-400">{c.gateway?.simApn ?? "—"}</td>
                <td className="py-3">
                  {c.gateway && (
                    <span className={`inline-flex items-center gap-1.5 ${TEXT[c.gateway.estado]} text-xs font-bold`}>
                      <span className={`w-2 h-2 rounded-full ${DOT[c.gateway.estado]}`} />
                      {c.gateway.estado}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
