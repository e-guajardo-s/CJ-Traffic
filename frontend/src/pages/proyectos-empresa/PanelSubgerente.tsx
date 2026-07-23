import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import StatCard from "../../components/StatCard";
import { esGerencia, esJefatura } from "../../roles";

// ────────── Types ──────────

interface UsuarioLite { id: number; nombre: string; }

interface SaludProyecto {
  id: number;
  nombre: string;
  tipoObra: string;
  faseGlobal: string;
  avance: number;
  coordinador: UsuarioLite | null;
  riesgoNivel: "OK" | "RIESGO" | "BLOQUEADO";
  riesgoMotivo: string;
  costoAcumulado?: string;
}

interface HitoReciente {
  id: number;
  tipoEvento: string;
  mensaje: string;
  createdAt: string;
  autor: UsuarioLite;
  obra: { id: number; nombre: string };
}

interface Alerta {
  obraId: number;
  obra: string;
  nivel: "RIESGO" | "BLOQUEADO";
  motivo: string;
}

interface DashboardData {
  kpis: {
    proyectosActivos: number;
    bloqueados: number;
    hitosSemana: number;
    costoIncurridoTotal: number | null;
  };
  saludProyectos: SaludProyecto[];
  hitosRecientes: HitoReciente[];
  alertas: Alerta[];
}

// ────────── Helpers ──────────

const FASE_LABEL: Record<string, string> = {
  INICIO: "Inicio",
  GESTION: "Gestión",
  EJECUCION: "Ejecución",
  CERRADO: "Cerrado",
};

const TIPO_LABEL: Record<string, string> = {
  NUEVO_SEMAFORO: "Nuevo semáforo",
  MODIFICACION: "Modificación",
  CCTV: "CCTV",
  MANTENCION: "Mantención",
};

const RIESGO_CHIP: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-700 border-emerald-200",
  RIESGO: "bg-amber-100 text-amber-700 border-amber-200",
  BLOQUEADO: "bg-red-100 text-red-700 border-red-200",
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

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

// ────────── Component ──────────

export default function PanelSubgerente() {
  const { usuario } = useAuth();
  const puedeVerCostos = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/proyectos-empresa/dashboard")
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
        <div className="h-64 rounded-xl bg-neutral-100" />
      </div>
    );
  }

  const { kpis, saludProyectos, hitosRecientes, alertas } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Panel Ejecutivo</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Estado global de la operación: avance, hitos y alertas de todos los proyectos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Proyectos activos" value={kpis.proyectosActivos} color="neutral" />
        <StatCard label="Bloqueados" value={kpis.bloqueados} color={kpis.bloqueados > 0 ? "red" : "neutral"} />
        <StatCard label="Hitos (7 días)" value={kpis.hitosSemana} color="violet" />
        {puedeVerCostos && kpis.costoIncurridoTotal !== null && (
          <StatCard label="Costo incurrido" value={clp.format(kpis.costoIncurridoTotal)} color="orange" />
        )}
      </div>

      {/* Alertas operativas */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p className="text-sm font-bold text-amber-800">Alertas operativas</p>
          </div>
          <div className="space-y-2">
            {alertas.map((a) => (
              <Link
                key={a.obraId}
                to={`/proyectos_empresa/detalle/${a.obraId}`}
                className="flex items-center gap-2 text-xs text-amber-800 hover:underline"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.nivel === "BLOQUEADO" ? "bg-red-500" : "bg-amber-500"}`} />
                <span className="font-bold">{a.obra}</span> — {a.motivo}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Salud de proyectos por fase */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Salud de proyectos por fase</h3>
            <Link to="/proyectos_empresa/tablero" className="text-[11px] font-semibold text-orange-600 hover:underline">Ver listado →</Link>
          </div>
          <p className="px-5 pb-4 text-[11px] text-neutral-500 leading-relaxed">
            La <strong>Salud del Proyecto</strong> evalúa el progreso general frente a los riesgos detectados en cada fase operativa (Inicio, Gestión, Ejecución, Cierre). Un proyecto se marca "En Riesgo" o "Bloqueado" si presenta atrasos críticos en permisos externos o la programación se detiene, alertando a la jefatura para tomar acción.
          </p>
          {saludProyectos.length === 0 ? (
            <p className="text-sm text-neutral-400 px-5 pb-6">No hay proyectos activos.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-y border-neutral-100 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="px-5 py-2">Proyecto</th>
                  <th className="px-3 py-2">Fase</th>
                  <th className="px-3 py-2 w-32">Avance</th>
                  {puedeVerCostos && <th className="px-3 py-2">Costo</th>}
                  <th className="px-3 py-2 pr-5">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {saludProyectos.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition">
                    <td className="px-5 py-3">
                      <Link to={`/proyectos_empresa/detalle/${p.id}`} className="font-semibold text-sm text-orange-600 hover:underline block">{p.nombre}</Link>
                      <span className="text-[11px] text-neutral-400">{TIPO_LABEL[p.tipoObra] ?? p.tipoObra}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase border bg-neutral-100 text-neutral-700 border-neutral-200">
                        {FASE_LABEL[p.faseGlobal] ?? p.faseGlobal}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-2.5 w-full rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${p.avance}%` }} />
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-1">{p.avance}%</div>
                    </td>
                    {puedeVerCostos && (
                      <td className="px-3 py-3 text-xs text-neutral-600 whitespace-nowrap">
                        {p.costoAcumulado != null ? clp.format(Number(p.costoAcumulado)) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-3 pr-5">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase border ${RIESGO_CHIP[p.riesgoNivel]}`}>
                        {p.riesgoNivel === "OK" ? "OK" : p.riesgoMotivo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Hitos recientes (toda la organización) */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">Hitos recientes</h3>
          {hitosRecientes.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">Sin hitos registrados todavía.</p>
          ) : (
            <ul className="space-y-4">
              {hitosRecientes.map((h) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-700 leading-snug">{h.mensaje}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      {h.obra.nombre} · {h.autor.nombre} · {tiempoRelativo(h.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
