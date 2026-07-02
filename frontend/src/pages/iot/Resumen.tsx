import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import StatCard from "../../components/StatCard";

interface DashboardData {
  gateways: { total: number; online: number; offline: number; degradado: number };
  gatewaysConProblemas: { cruceId: number; codigo: string; ubicacion: string; estado: string }[];
  actividad: {
    id: number;
    accion: string;
    entidad: string;
    entidadId: number;
    createdAt: string;
    autor: { id: number; nombre: string };
  }[];
  tareas: {
    pendientes: number;
    vencidas: number;
    proximas: {
      id: number;
      titulo: string;
      estado: string;
      fechaLimite: string | null;
      proyecto: { id: number; nombre: string };
      asignado: { id: number; nombre: string } | null;
    }[];
  };
  stockBajo: { id: number; nombre: string; disponibles: number; umbralMinimo: number }[];
  proyectos: { total: number; enProgreso: number };
}

// "gateway.mantencion.registrar" → "Gateway · mantención · registrar"
const ACCION_LABEL: Record<string, string> = {
  "gateway.actualizar": "actualizó un gateway",
  "gateway.eliminar": "retiró un gateway",
  "gateway.mantencion.registrar": "registró una mantención",
  "gateway.mantencion.eliminar": "eliminó una mantención",
  "cruce.crear": "registró un cruce",
  "cruce.eliminar": "eliminó un cruce",
  "proyecto.tecnologia.crear": "creó una tecnología",
  "proyecto.tecnologia.eliminar": "eliminó una tecnología",
  "proyecto.tecnologia.enlazar": "enlazó una tecnología a un proyecto",
  "proyecto.archivo.subir": "subió un archivo técnico",
  "proyecto.archivo.eliminar": "eliminó un archivo técnico",
  "proyecto.stack.agregar": "agregó un componente al stack",
  "proyecto.stack.eliminar": "quitó un componente del stack",
  "glosario.termino.crear": "agregó un término al glosario",
  "glosario.termino.eliminar": "eliminó un término del glosario",
};

function describirAccion(accion: string): string {
  return ACCION_LABEL[accion] ?? accion.replaceAll(".", " · ");
}

function tiempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} día${dias !== 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("es-CL");
}

function formatFechaLimite(iso: string | null): string {
  if (!iso) return "sin fecha límite";
  return new Date(iso).toLocaleDateString("es-CL", { timeZone: "UTC" });
}

const ESTADO_TAREA_CHIP: Record<string, string> = {
  POR_HACER: "bg-neutral-200 text-neutral-600",
  EN_PROGRESO: "bg-sky-100 text-sky-700",
  EN_REVISION: "bg-violet-100 text-violet-700",
};

export default function IotResumen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/iot/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-100" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-xl bg-neutral-100" />
          <div className="h-64 rounded-xl bg-neutral-100" />
        </div>
      </div>
    );
  }

  const { gateways, gatewaysConProblemas, actividad, tareas, stockBajo, proyectos } = data;
  const hayAlertas = gatewaysConProblemas.length > 0 || tareas.vencidas > 0 || stockBajo.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Gateways registrados" value={gateways.total} color="neutral" />
        <StatCard label="Online" value={gateways.online} color="emerald" />
        <StatCard label="Con problemas" value={gateways.offline + gateways.degradado} color={gateways.offline + gateways.degradado > 0 ? "red" : "neutral"} />
        <StatCard label="Proyectos en progreso" value={proyectos.enProgreso} color="violet" />
      </div>

      {hayAlertas && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p className="text-sm font-bold text-amber-800">Alertas operativas</p>
          </div>
          <div className="space-y-2">
            {gatewaysConProblemas.map((g) => (
              <div key={g.cruceId} className="flex items-center gap-2 text-xs text-amber-800">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${g.estado === "OFFLINE" ? "bg-red-500" : "bg-amber-500"}`} />
                Gateway <span className="font-mono font-bold">{g.codigo}</span> ({g.ubicacion}) está{" "}
                <span className="font-bold">{g.estado === "OFFLINE" ? "offline" : "degradado"}</span>
              </div>
            ))}
            {tareas.vencidas > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="font-bold">{tareas.vencidas}</span> tarea{tareas.vencidas !== 1 ? "s" : ""} de proyectos con fecha límite vencida
              </div>
            )}
            {stockBajo.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-xs text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Stock bajo de <span className="font-bold">{i.nombre}</span>: {i.disponibles} disponible{i.disponibles !== 1 ? "s" : ""} (umbral: {i.umbralMinimo})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">Actividad reciente</h3>
          {actividad.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">Sin actividad registrada todavía.</p>
          ) : (
            <ul className="space-y-3">
              {actividad.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-neutral-700 leading-snug">
                      <span className="font-semibold">{a.autor.nombre}</span> {describirAccion(a.accion)}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{tiempoRelativo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Próximas tareas de proyectos</h3>
            <span className="text-[11px] text-neutral-400">{tareas.pendientes} pendiente{tareas.pendientes !== 1 ? "s" : ""}</span>
          </div>
          {tareas.proximas.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">No hay tareas pendientes en proyectos activos.</p>
          ) : (
            <ul className="space-y-2.5">
              {tareas.proximas.map((t) => {
                const vencida = t.fechaLimite && new Date(t.fechaLimite) < new Date();
                return (
                  <li key={t.id} className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-700 truncate">{t.titulo}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${ESTADO_TAREA_CHIP[t.estado] ?? "bg-neutral-200 text-neutral-600"}`}>
                        {t.estado.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      {t.proyecto.nombre}
                      {t.asignado && <> · {t.asignado.nombre}</>}
                      {" · "}
                      <span className={vencida ? "text-red-500 font-bold" : ""}>{formatFechaLimite(t.fechaLimite)}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
