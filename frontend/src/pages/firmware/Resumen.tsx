import StatCard from "../../components/StatCard";
import type { Programacion } from "./types";

export default function FirmwareResumen({ programaciones }: { programaciones: Programacion[] }) {
  const enCola = programaciones.filter((p) => p.estado === "EN_COLA").length;
  const enPrueba = programaciones.filter((p) => p.estado === "EN_PRUEBA").length;
  const aprobado = programaciones.filter((p) => p.estado === "APROBADO").length;
  const rechazado = programaciones.filter((p) => p.estado === "RECHAZADO").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="En cola" value={enCola} color="neutral" />
        <StatCard label="En prueba" value={enPrueba} color="violet" />
        <StatCard label="Aprobadas" value={aprobado} color="emerald" />
        <StatCard label="Rechazadas" value={rechazado} color="red" />
      </div>

      {rechazado > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Programaciones rechazadas pendientes de corrección</p>
          <p className="text-xs text-red-700 mt-1">
            {rechazado} versión(es) con feedback de rechazo. Revisar en Historial y Feedback.
          </p>
        </div>
      )}
    </div>
  );
}
