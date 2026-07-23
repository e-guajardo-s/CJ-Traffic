import { useRef, useState, type FC } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { ITask, IApi, IMarker, IScaleConfig, IColumnConfig } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/style.css";
import { apiFetch } from "../../api";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";

// ────────── Types ──────────
// Tipos locales mínimos (mismo patrón que GraficosProyecto.tsx: cada componente
// declara solo lo que necesita, sin importar entre archivos hermanos).

interface SubtareaGantt {
  id: number;
  titulo: string;
  estado: string;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  fechaEstimadaDesbloqueo: string | null;
}

interface TrackGantt {
  id: number;
  tipo: string;
  nombre: string | null;
  estadoActual: string;
  subtareas: SubtareaGantt[];
}

interface ObraGantt {
  fechaInicio: string | null;
  fechaEntrega: string | null;
  tracks: TrackGantt[];
}

// ────────── Clasificación de tracks por avance (duplica la lógica de
// ProyectoEmpresaDetalle.tsx / GraficosProyecto.tsx — mantener en sync) ──────────

type Bucket = "NO_INICIADO" | "EN_CURSO" | "ESPERANDO" | "CASI_COMPLETO" | "COMPLETADO" | "BLOQUEADO";

function clasificarEstadoTrack(estadoActual: string): Bucket {
  const e = estadoActual.toUpperCase();
  if (e.startsWith("BLOQUEADO")) return "BLOQUEADO";
  if (e.includes("ESPERANDO")) return "ESPERANDO";
  if (["COMPLETADO", "FINALIZADO", "DESPACHADO", "RECIBIDO", "CERRADO"].some((s) => e.includes(s))) return "COMPLETADO";
  if (["APROBADO", "TERRENO", "REVISION", "REVISADO"].some((s) => e.includes(s))) return "CASI_COMPLETO";
  if (["EN_CURSO", "TRAMITE", "PROCESO", "COTIZANDO", "ORDEN_COMPRA"].some((s) => e.includes(s))) return "EN_CURSO";
  return "NO_INICIADO";
}

const BUCKET_COLOR: Record<Bucket, string> = {
  NO_INICIADO: "#a3a3a3",
  EN_CURSO: "#0ea5e9",
  ESPERANDO: "#f59e0b",
  CASI_COMPLETO: "#14b8a6",
  COMPLETADO: "#10b981",
  BLOQUEADO: "#ef4444",
};

const TRACK_LABEL: Record<string, string> = {
  PERMISOS: "Permisos",
  ADQUISICIONES: "Materiales",
  PROGRAMACION: "Programación",
  INSTALACION: "Instalación",
  COMUNICACIONES: "Enlace",
  ENLACES: "Enlaces",
  EMPALMES: "Empalmes",
  HITOS_UOCT: "Hitos UOCT",
  SINTONIA_FINA: "Sintonía Fina",
  TRASPASOS_MANTENCION: "Traspasos y Mantención",
  CANALIZACION: "Canalización",
  OBRAS_CIVILES: "Obras Civiles",
};

function labelTrackGantt(track: { tipo: string; nombre: string | null }): string {
  if (track.tipo === "OTRO") return track.nombre || "Otro";
  return TRACK_LABEL[track.tipo] ?? track.tipo;
}

// Color por estado de SUBTAREA (distinto del balde de track: son valores del
// enum EstadoTarea del kanban, no del estadoActual libre del track).
const ESTADO_SUBTAREA_COLOR: Record<string, string> = {
  POR_HACER: "#a3a3a3",
  EN_PROGRESO: "#0ea5e9",
  EN_REVISION: "#8b5cf6",
  HECHO: "#10b981",
  BLOQUEADO: "#ef4444",
};

const ESTADOS_SUBTAREA: { id: string; label: string }[] = [
  { id: "POR_HACER", label: "Por hacer" },
  { id: "EN_PROGRESO", label: "En progreso" },
  { id: "EN_REVISION", label: "En revisión" },
  { id: "HECHO", label: "Hecho" },
  { id: "BLOQUEADO", label: "Bloqueado" },
];

function fmtEstadoLabel(estado: string): string {
  return ESTADOS_SUBTAREA.find((e) => e.id === estado)?.label ?? estado.replaceAll("_", " ");
}

// El avance de una subtarea se deriva de su estado (no es un campo editable
// independiente), igual que en el resto del módulo.
function pctPorEstado(estado: string): number {
  switch (estado) {
    case "HECHO": return 100;
    case "EN_REVISION": return 75;
    case "EN_PROGRESO": return 40;
    default: return 0; // POR_HACER, BLOQUEADO
  }
}

// Tarea de SVAR extendida con los campos propios que necesita el taskTemplate
// (color, si es fila de track, y la subtarea original para abrir el modal).
type TareaGantt = ITask & {
  _color: string;
  _esTrack: boolean;
  _sub?: SubtareaGantt;
};

function construirTareas(obra: ObraGantt): TareaGantt[] {
  const tareas: TareaGantt[] = [];

  for (const track of obra.tracks) {
    if (track.subtareas.length === 0) continue;

    const total = track.subtareas.length;
    const hechas = track.subtareas.filter((s) => s.estado === "HECHO").length;
    const pctTrack = total > 0 ? Math.round((hechas / total) * 100) : 0;

    tareas.push({
      id: `t${track.id}`,
      text: labelTrackGantt(track),
      type: "summary",
      open: true,
      progress: pctTrack,
      _color: BUCKET_COLOR[clasificarEstadoTrack(track.estadoActual)],
      _esTrack: true,
    });

    for (const sub of track.subtareas) {
      const fin = new Date(sub.fechaVencimiento as string);
      const inicio = sub.fechaInicio ? new Date(sub.fechaInicio) : fin;
      tareas.push({
        id: `s${sub.id}`,
        parent: `t${track.id}`,
        text: sub.titulo,
        type: "task",
        start: inicio,
        end: fin,
        progress: pctPorEstado(sub.estado),
        _color: ESTADO_SUBTAREA_COLOR[sub.estado] ?? "#a3a3a3",
        _esTrack: false,
        _sub: sub,
      });
    }
  }

  return tareas;
}

const ESCALAS: IScaleConfig[] = [
  { unit: "month", step: 1, format: (d: Date) => d.toLocaleDateString("es-CL", { month: "long", year: "numeric" }) },
  { unit: "week", step: 1, format: (d: Date) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }) },
];

const COLUMNAS: IColumnConfig[] = [{ id: "text", header: "Línea de trabajo / Tarea", flexgrow: 1 }];

// ────────── Modal: cambiar estado de una subtarea desde el Gantt ──────────

function CambiarEstadoModal({ sub, titulo, onClose, onSaved }: { sub: SubtareaGantt; titulo: string; onClose: () => void; onSaved: () => void }) {
  const [estado, setEstado] = useState(sub.estado);
  const [fechaDesbloqueo, setFechaDesbloqueo] = useState(sub.fechaEstimadaDesbloqueo?.slice(0, 10) ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (estado === "BLOQUEADO" && !fechaDesbloqueo) return;
    setGuardando(true);
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          estado,
          fechaEstimadaDesbloqueo: estado === "BLOQUEADO" ? fechaDesbloqueo : null,
        }),
      });
      showToast("Estado actualizado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={`Cambiar estado — ${titulo}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {ESTADOS_SUBTAREA.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
          </select>
        </div>
        {estado === "BLOQUEADO" && (
          <div>
            <label className="text-xs text-red-700 block mb-1.5">Fecha estimada de desbloqueo *</label>
            <input
              type="date"
              value={fechaDesbloqueo}
              onChange={(e) => setFechaDesbloqueo(e.target.value)}
              className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${!fechaDesbloqueo ? "border-red-300" : "border-neutral-300"}`}
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || (estado === "BLOQUEADO" && !fechaDesbloqueo)}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ────────── Componente principal ──────────

export default function GanttProyecto({ obra, onChanged }: { obra: ObraGantt; onChanged: () => void }) {
  const [editando, setEditando] = useState<{ sub: SubtareaGantt; titulo: string } | null>(null);
  const apiRef = useRef<IApi | null>(null);

  const tracksConSubtareas = obra.tracks.filter((t) => t.subtareas.length > 0);
  if (tracksConSubtareas.length === 0) {
    return <p className="text-sm text-neutral-400 italic">Aún no hay tareas con fechas para mostrar en la carta Gantt.</p>;
  }

  const tareas = construirTareas(obra);
  const markers: IMarker[] = [{ start: new Date(), text: "Hoy", css: "gantt-marker-hoy" }];

  // Expandir/colapsar todos los tracks a la vez, vía la API imperativa de SVAR
  // (capturada con `init`) — `tasks` es la fuente de datos, pero el estado
  // abierto/cerrado de cada fila lo maneja el store interno de SVAR.
  function abrirTodos(abierto: boolean) {
    const api = apiRef.current;
    if (!api) return;
    for (const t of tareas) {
      if (t.type === "summary" && t.id !== undefined) {
        api.exec("open-task", { id: t.id, mode: abierto });
      }
    }
  }

  // Contenido dentro de cada barra: color por estado/balde + % + acceso directo
  // para cambiar el estado de una subtarea (botón propio de React, independiente
  // de los gestos de arrastre de SVAR — funciona igual con `readonly`).
  const TaskTemplate: FC<{ data: ITask }> = ({ data }) => {
    const t = data as TareaGantt;
    if (t._esTrack) {
      return (
        <div
          className="h-full w-full rounded flex items-center gap-1.5 px-2.5 text-[11px] font-bold text-white overflow-hidden shadow-sm ring-1 ring-inset ring-white/25"
          style={{ backgroundColor: t._color }}
        >
          <svg width="12" height="12" className="shrink-0 opacity-90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="truncate">{t.text}</span>
          <span className="ml-auto shrink-0 bg-white/20 rounded px-1.5 py-0.5">{t.progress}%</span>
        </div>
      );
    }
    const sub = t._sub!;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditando({ sub, titulo: t.text ?? sub.titulo }); }}
        title={`${fmtEstadoLabel(sub.estado)} — click para cambiar el estado`}
        className="h-full w-full rounded flex items-center gap-1 px-2 text-[10px] font-semibold text-white overflow-hidden cursor-pointer ring-1 ring-inset ring-white/15 hover:ring-white/40 transition-shadow"
        style={{ backgroundColor: t._color }}
      >
        {sub.estado === "BLOQUEADO" && (
          <svg width="10" height="10" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        <span className="truncate">{t.text}</span>
      </button>
    );
  };

  return (
    <div>
      {/* Barra de herramientas: expandir/colapsar + leyenda de colores */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => abrirTodos(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Expandir todo
          </button>
          <button
            type="button"
            onClick={() => abrirTodos(false)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
            Colapsar todo
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {ESTADOS_SUBTAREA.map((e) => {
            const color = ESTADO_SUBTAREA_COLOR[e.id];
            return (
              <span
                key={e.id}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: `${color}1A`, borderColor: `${color}55`, color }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {e.label}
              </span>
            );
          })}
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-orange-300 bg-orange-50 text-orange-700">
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            Hoy
          </span>
        </div>
      </div>

      {/* Widget Gantt enmarcado, separado visualmente de la barra de herramientas */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden">
        <Willow>
          <Gantt
            tasks={tareas}
            scales={ESCALAS}
            columns={COLUMNAS}
            markers={markers}
            readonly
            cellHeight={34}
            scaleHeight={36}
            taskTemplate={TaskTemplate}
            init={(api) => { apiRef.current = api; }}
          />
        </Willow>
      </div>

      {editando && (
        <CambiarEstadoModal
          sub={editando.sub}
          titulo={editando.titulo}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onChanged(); }}
        />
      )}
    </div>
  );
}
