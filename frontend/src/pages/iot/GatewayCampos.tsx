import { ESTADO_GATEWAY_LABEL, type EstadoGateway } from "./types";

export interface GatewayCamposValue {
  modelo: string;
  estado: EstadoGateway;
  fechaInstalacion: string; // yyyy-mm-dd, "" si no hay
  fechaDesinstalacion: string;
  enMantencion: boolean;
}

export function gatewayCamposIniciales(gateway?: {
  modelo: string | null;
  estado: EstadoGateway;
  fechaInstalacion: string | null;
  fechaDesinstalacion: string | null;
  enMantencion: boolean;
} | null): GatewayCamposValue {
  return {
    modelo: gateway?.modelo ?? "",
    estado: gateway?.estado ?? "OFFLINE",
    fechaInstalacion: gateway?.fechaInstalacion ? gateway.fechaInstalacion.slice(0, 10) : "",
    fechaDesinstalacion: gateway?.fechaDesinstalacion ? gateway.fechaDesinstalacion.slice(0, 10) : "",
    enMantencion: gateway?.enMantencion ?? false,
  };
}

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function GatewayCampos({
  value,
  onChange,
}: {
  value: GatewayCamposValue;
  onChange: (patch: Partial<GatewayCamposValue>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-neutral-500 block mb-1.5">
          Modelo de gateway <span className="text-neutral-400 normal-case">(opcional — puede quedar pendiente hasta la instalación)</span>
        </label>
        <input value={value.modelo} onChange={(e) => onChange({ modelo: e.target.value })} className={inputClass} />
      </div>

      <div>
        <label className="text-xs text-neutral-500 block mb-1.5">
          Estado de conectividad <span className="text-neutral-400 normal-case">(manual hasta integrar la API de CJ Smart Traffic)</span>
        </label>
        <select value={value.estado} onChange={(e) => onChange({ estado: e.target.value as EstadoGateway })} className={inputClass}>
          {(Object.keys(ESTADO_GATEWAY_LABEL) as EstadoGateway[]).map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_GATEWAY_LABEL[estado]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Fecha instalación</label>
          <input
            type="date"
            value={value.fechaInstalacion}
            onChange={(e) => onChange({ fechaInstalacion: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Fecha desinstalación</label>
          <input
            type="date"
            value={value.fechaDesinstalacion}
            onChange={(e) => onChange({ fechaDesinstalacion: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={value.enMantencion}
          onChange={(e) => onChange({ enMantencion: e.target.checked })}
          className="rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
        />
        En mantención
      </label>
    </div>
  );
}
