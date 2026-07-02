import StatCard from "../../components/StatCard";
import type { Cruce } from "./types";

export default function IotResumen({ cruces }: { cruces: Cruce[] }) {
  const conGateway = cruces.filter((c) => c.gateway);
  const online = conGateway.filter((c) => c.gateway?.estado === "ONLINE").length;
  const offline = conGateway.filter((c) => c.gateway?.estado === "OFFLINE").length;
  const degradado = conGateway.filter((c) => c.gateway?.estado === "DEGRADADO").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Cruces totales" value={cruces.length} color="neutral" />
        <StatCard label="Gateways online" value={online} color="emerald" />
        <StatCard label="Gateways offline" value={offline} color="red" />
        <StatCard label="Degradados" value={degradado} color="amber" />
      </div>

      {offline + degradado > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Atención requerida</p>
          <p className="text-xs text-amber-700 mt-1">
            {offline > 0 && `${offline} gateway(s) sin conexión`}
            {offline > 0 && degradado > 0 && " · "}
            {degradado > 0 && `${degradado} con señal degradada`}. Revisar en el Directorio de Gateways.
          </p>
        </div>
      )}
    </div>
  );
}
