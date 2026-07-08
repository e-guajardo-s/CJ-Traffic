import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";

// ────────── Types ──────────

interface UsuarioLite { id: number; nombre: string; }
interface UsuarioConRol extends UsuarioLite { rol: string; }

type EstadoSubtarea = "POR_HACER" | "EN_PROGRESO" | "EN_REVISION" | "HECHO";

interface SubtareaArchivo {
  id: number;
  nombre: string;
  url: string;
  extension: string;
}

interface Subtarea {
  id: number;
  titulo: string;
  estado: EstadoSubtarea;
  orden: number;
  notas: string | null;
  archivos: SubtareaArchivo[];
}

interface ObraTrack {
  id: number;
  tipo: string;
  estadoActual: string;
  responsable?: UsuarioLite | null;
  ultimaActualizacion: string;
  subtareas: Subtarea[];
}

interface ItemSolicitud {
  id: number;
  articuloDesc: string;
  cantidad: number;
  itemId: number | null;
  precioUnitario?: string | null;
}

interface Solicitud {
  id: number;
  estado: string;
  costoTotal?: string | null;
  solicitante: UsuarioLite;
  items: ItemSolicitud[];
}

interface ObraBitacora {
  id: number;
  tipoEvento: string;
  mensaje: string;
  createdAt: string;
  autor: UsuarioLite;
}

interface ObraDetalle {
  id: number;
  codigoObra: string;
  nombre: string;
  cliente: string;
  tipoObra: string;
  faseGlobal: string;
  avance: number;
  presupuesto?: string | null;
  costoAcumulado?: string;
  subgerente: UsuarioLite | null;
  coordinador: UsuarioLite | null;
  fechaInicio: string | null;
  fechaEntrega: string | null;
  tracks: ObraTrack[];
  bitacora: ObraBitacora[];
  solicitudes: Solicitud[];
}

// ────────── Config ──────────

const FASES = ["INICIO", "GESTION", "EJECUCION", "CERRADO"] as const;
const FASE_LABEL: Record<string, string> = { INICIO: "Inicio", GESTION: "Gestión", EJECUCION: "Ejecución", CERRADO: "Cerrado" };

const TRACK_META: Record<string, { label: string; nota?: string }> = {
  PERMISOS: { label: "Permisos", nota: "Depende de organismos externos" },
  ADQUISICIONES: { label: "Materiales", nota: "Bodega" },
  PROGRAMACION: { label: "Programación", nota: "Servicio Técnico" },
  INSTALACION: { label: "Instalación", nota: "Terreno" },
  COMUNICACIONES: { label: "Enlace", nota: "Servicio Técnico" },
};

// Iconos de línea (mismo estilo que el resto de la app), sin emojis.
function TrackIcon({ tipo, className = "w-4 h-4" }: { tipo: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    PERMISOS: <><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M9 3v6h6" /><path d="M9 3l6 6" /></>,
    ADQUISICIONES: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
    PROGRAMACION: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></>,
    INSTALACION: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    COMUNICACIONES: <><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[tipo] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

const COLUMNAS: { estado: EstadoSubtarea; label: string }[] = [
  { estado: "POR_HACER", label: "Por hacer" },
  { estado: "EN_PROGRESO", label: "En progreso" },
  { estado: "EN_REVISION", label: "En revisión" },
  { estado: "HECHO", label: "Hecho" },
];
const ORDEN_ESTADOS = COLUMNAS.map((c) => c.estado);

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function fmtEstado(s: string) {
  return s.replaceAll("_", " ");
}

// ────────── Main component ──────────

export default function ProyectoEmpresaDetalle() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const puedeAdministrar = usuario?.rol === "gerencia" || usuario?.rol === "jefatura";
  const puedeVerCostos = puedeAdministrar;

  const [obra, setObra] = useState<ObraDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);

  const [reasignando, setReasignando] = useState(false);
  const [registrandoHito, setRegistrandoHito] = useState(false);

  function cargar() {
    apiFetch<ObraDetalle>(`/proyectos-empresa/${proyectoId}`)
      .then(setObra)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, [proyectoId]);
  useEffect(() => {
    apiFetch<UsuarioConRol[]>("/proyectos-empresa/usuarios").then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function eliminarObra() {
    if (!obra) return;
    if (!confirm(`¿Eliminar el proyecto "${obra.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}`, { method: "DELETE" });
      showToast("Proyecto eliminado", "success");
      navigate("/proyectos_empresa/tablero");
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!obra) return <CargandoTabla />;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/proyectos_empresa/tablero" className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-orange-600 transition-colors">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Volver al listado
      </Link>

      {/* Header card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-neutral-800 tracking-tight">{obra.nombre}</h1>
              <span className="text-xs font-bold px-3 py-1 rounded-full border bg-neutral-100 text-neutral-700">
                {FASE_LABEL[obra.faseGlobal] ?? obra.faseGlobal}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1 max-w-3xl leading-relaxed">
              <strong>{obra.codigoObra}</strong> — Cliente: {obra.cliente} ({fmtEstado(obra.tipoObra)})
            </p>

            <div className="flex items-center gap-6 flex-wrap mt-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                <span className="font-semibold text-neutral-700">Jefe:</span> {obra.subgerente?.nombre ?? "No asignado"}
              </span>
              <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                <span className="font-semibold text-neutral-700">Coord:</span> {obra.coordinador?.nombre ?? "No asignado"}
              </span>
              <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                <span className="font-semibold text-neutral-700">Avance:</span> {obra.avance}%
              </span>
              {puedeVerCostos && (
                <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                  <span className="font-semibold text-neutral-700">Costos:</span> {clp.format(Number(obra.costoAcumulado ?? 0))} / {obra.presupuesto ? clp.format(Number(obra.presupuesto)) : "—"}
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-wrap">
            {puedeAdministrar && (
              <button onClick={() => setReasignando(true)} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
                Asignar responsables
              </button>
            )}
            <button onClick={() => setRegistrandoHito(true)} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg shadow-sm cursor-pointer">
              + Registrar hito
            </button>
            {puedeAdministrar && (
              <button onClick={eliminarObra} className="text-xs font-semibold bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-2 rounded-lg cursor-pointer">
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Pipeline de fases */}
        <div className="flex items-center gap-2 mt-6 flex-wrap">
          {FASES.map((fase, i) => {
            const idx = FASES.indexOf(obra.faseGlobal as (typeof FASES)[number]);
            const estado = i < idx ? "hecho" : i === idx ? "actual" : "pend";
            return (
              <div key={fase} className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
                  estado === "hecho" ? "bg-neutral-200 text-neutral-600 border-neutral-200"
                  : estado === "actual" ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-neutral-400 border-dashed border-neutral-300"
                }`}>
                  {FASE_LABEL[fase]}
                </span>
                {i < FASES.length - 1 && <span className="text-neutral-300">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracks (líneas de trabajo) */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Líneas de trabajo (haz clic para abrir su tablero)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {obra.tracks.map((track) => {
            const meta = TRACK_META[track.tipo] ?? { label: track.tipo };
            const total = track.subtareas.length;
            const hechas = track.subtareas.filter((s) => s.estado === "HECHO").length;
            return (
              <button
                key={track.id}
                onClick={() => navigate(`/proyectos_empresa/detalle/${obra.id}/track/${track.id}`)}
                className="text-left bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:border-orange-300 hover:shadow transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                    <span className="text-neutral-400"><TrackIcon tipo={track.tipo} /></span> {meta.label}
                  </h4>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                    track.estadoActual.startsWith("BLOQUEADO") ? "bg-red-100 text-red-700 border-red-200"
                    : track.estadoActual.includes("ESPERANDO") ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-neutral-100 text-neutral-600 border-neutral-200"
                  }`}>
                    {fmtEstado(track.estadoActual)}
                  </span>
                </div>
                {meta.nota && <p className="text-[11px] text-neutral-400 mt-1">{meta.nota}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-neutral-500">
                    Responsable: <span className="font-semibold text-neutral-700">{track.responsable?.nombre ?? "N/A"}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-500">{hechas}/{total} subtareas</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bitácora + Costos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Bitácora Histórica</h3>
          {obra.bitacora.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">No hay registros.</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {obra.bitacora.map((b) => (
                <div key={b.id} className="flex gap-3">
                  <div className="w-8 h-8 shrink-0 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs">
                    {b.autor.nombre.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-neutral-800">{b.autor.nombre}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(b.createdAt).toLocaleString("es-CL")}</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{b.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {puedeVerCostos && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Costos del proyecto</h3>
            <p className="text-3xl font-black text-neutral-800">{clp.format(Number(obra.costoAcumulado ?? 0))}</p>
            <p className="text-xs text-neutral-500 mt-1">Incurrido de {obra.presupuesto ? clp.format(Number(obra.presupuesto)) : "—"} presupuestado</p>
            {obra.presupuesto && (
              <div className="h-2.5 w-full rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden mt-3">
                <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (Number(obra.costoAcumulado ?? 0) / Number(obra.presupuesto)) * 100)}%` }} />
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-3">Se alimenta de las solicitudes de materiales (track Materiales).</p>
          </div>
        )}
      </div>

      {/* Modales */}
      {reasignando && (
        <ReasignarModal obra={obra} usuarios={usuarios} onClose={() => setReasignando(false)} onSaved={() => { setReasignando(false); cargar(); }} />
      )}
      {registrandoHito && (
        <HitoModal obraId={obra.id} onClose={() => setRegistrandoHito(false)} onSaved={() => { setRegistrandoHito(false); cargar(); }} />
      )}
    </div>
  );
}

// ────────── Vista del track (ruta propia, dentro del layout con header + sidebar) ──────────

export function TrackVista() {
  const { proyectoId, trackId } = useParams();
  const { usuario } = useAuth();
  const puedeVerCostos = usuario?.rol === "gerencia" || usuario?.rol === "jefatura";

  const [obra, setObra] = useState<ObraDetalle | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    apiFetch<ObraDetalle>(`/proyectos-empresa/${proyectoId}`)
      .then(setObra)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, [proyectoId]);
  useEffect(() => {
    apiFetch<UsuarioConRol[]>("/proyectos-empresa/usuarios").then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!obra) return <CargandoTabla />;

  const track = obra.tracks.find((t) => String(t.id) === trackId);
  if (!track) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">Línea de trabajo no encontrada.</p>
        <Link to={`/proyectos_empresa/detalle/${obra.id}`} className="text-xs font-semibold text-orange-600 hover:underline">Volver al proyecto</Link>
      </div>
    );
  }

  return <TrackVistaContenido track={track} obra={obra} usuarios={usuarios} puedeVerCostos={puedeVerCostos} onChanged={cargar} />;
}

function TrackVistaContenido({
  track, obra, usuarios, puedeVerCostos, onChanged,
}: {
  track: ObraTrack;
  obra: ObraDetalle;
  usuarios: UsuarioConRol[];
  puedeVerCostos: boolean;
  onChanged: () => void;
}) {
  const meta = TRACK_META[track.tipo] ?? { label: track.tipo };
  const [estado, setEstado] = useState(track.estadoActual);
  const [responsableId, setResponsableId] = useState<string>(track.responsable?.id?.toString() ?? "");
  const [guardandoCab, setGuardandoCab] = useState(false);
  const [subSel, setSubSel] = useState<number | null>(null);

  const total = track.subtareas.length;
  const hechas = track.subtareas.filter((s) => s.estado === "HECHO").length;
  const subActiva = track.subtareas.find((s) => s.id === subSel) ?? null;

  const ctrl = "bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500";

  async function guardarCabecera() {
    setGuardandoCab(true);
    try {
      await apiFetch(`/proyectos-empresa/tracks/${track.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estadoActual: estado.trim(), responsableId: responsableId || null }),
      });
      showToast("Track actualizado", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setGuardandoCab(false);
    }
  }

  async function agregarSub(estadoCol: EstadoSubtarea, titulo: string) {
    if (!titulo.trim()) return;
    try {
      await apiFetch(`/proyectos-empresa/tracks/${track.id}/subtareas`, {
        method: "POST",
        body: JSON.stringify({ titulo: titulo.trim(), estado: estadoCol }),
      });
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  async function moverSub(sub: Subtarea, dir: -1 | 1) {
    const i = ORDEN_ESTADOS.indexOf(sub.estado);
    const destino = ORDEN_ESTADOS[i + dir];
    if (!destino) return;
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}`, { method: "PATCH", body: JSON.stringify({ estado: destino }) });
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  async function borrarSub(sub: Subtarea) {
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}`, { method: "DELETE" });
      if (subSel === sub.id) setSubSel(null);
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={`/proyectos_empresa/detalle/${obra.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-orange-600 transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Volver al proyecto
        </Link>
        <div className="w-px h-5 bg-neutral-200" />
        <span className="text-neutral-400"><TrackIcon tipo={track.tipo} className="w-5 h-5" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-neutral-800 leading-tight">{meta.label}</h2>
          <p className="text-[11px] text-neutral-400 leading-tight truncate">{obra.nombre} · {obra.codigoObra}</p>
        </div>
        <span className="ml-auto text-xs font-semibold text-neutral-500">{hechas}/{total} subtareas</span>
      </div>

      {/* Toolbar: estado + responsable del track */}
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <label className="text-[11px] text-neutral-500">Estado del track</label>
        <input value={estado} onChange={(e) => setEstado(e.target.value)} className={`${ctrl} w-52`} placeholder="EN_TRAMITE, BLOQUEADO…" />
        <label className="text-[11px] text-neutral-500 ml-2">Responsable</label>
        <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className={ctrl}>
          <option value="">Sin asignar</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <button onClick={guardarCabecera} disabled={guardandoCab} className="text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-900 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg cursor-pointer">
          {guardandoCab ? "Guardando…" : "Guardar"}
        </button>
        <span className="text-[11px] text-neutral-400 ml-auto">Actualizado {new Date(track.ultimaActualizacion).toLocaleString("es-CL")}</span>
      </div>

      {/* Kanban (scroll horizontal dentro del contenido) */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 items-start min-w-max">
          {COLUMNAS.map((col) => {
            const items = track.subtareas.filter((s) => s.estado === col.estado).sort((a, b) => a.orden - b.orden);
            return (
              <div key={col.estado} className="w-72 shrink-0 bg-neutral-100/70 border border-neutral-200 rounded-xl flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{col.label}</span>
                  <span className="text-[10px] font-semibold text-neutral-400 bg-white rounded-full px-2 py-0.5 border border-neutral-200">{items.length}</span>
                </div>
                <div className="p-2.5 space-y-2">
                  {items.map((sub) => {
                    const i = ORDEN_ESTADOS.indexOf(sub.estado);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSubSel(sub.id)}
                        className="bg-white border border-neutral-200 rounded-lg p-2.5 group cursor-pointer hover:border-orange-300 hover:shadow-sm transition"
                      >
                        <p className={`text-xs leading-snug ${sub.estado === "HECHO" ? "line-through text-neutral-400" : "text-neutral-700"}`}>{sub.titulo}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-400">
                          {sub.archivos.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                              {sub.archivos.length}
                            </span>
                          )}
                          {sub.notas && (
                            <span className="flex items-center gap-0.5">
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
                              nota
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); moverSub(sub, -1); }} disabled={i === 0} className="w-5 h-5 rounded border border-neutral-200 text-neutral-500 disabled:opacity-30 hover:bg-neutral-100 leading-none cursor-pointer">‹</button>
                            <button onClick={(e) => { e.stopPropagation(); moverSub(sub, 1); }} disabled={i === ORDEN_ESTADOS.length - 1} className="w-5 h-5 rounded border border-neutral-200 text-neutral-500 disabled:opacity-30 hover:bg-neutral-100 leading-none cursor-pointer">›</button>
                            <button onClick={(e) => { e.stopPropagation(); borrarSub(sub); }} className="opacity-0 group-hover:opacity-100 transition text-neutral-300 hover:text-red-500 cursor-pointer">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <AgregarSubtarea onAdd={(t) => agregarSub(col.estado, t)} />
                </div>
              </div>
            );
          })}

          {/* Inventario asociado (solo Materiales) como columna extra */}
          {track.tipo === "ADQUISICIONES" && (
            <div className="w-80 shrink-0 bg-white border border-neutral-200 rounded-xl p-4">
              <MaterialesPanel obra={obra} puedeVerCostos={puedeVerCostos} onChanged={onChanged} />
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral de la subtarea (notas + adjuntos) */}
      {subActiva && (
        <SubtareaDrawer sub={subActiva} onClose={() => setSubSel(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

// ────────── Panel lateral de una subtarea: notas + documentación ──────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function SubtareaDrawer({ sub, onClose, onChanged }: { sub: Subtarea; onClose: () => void; onChanged: () => void }) {
  const [notas, setNotas] = useState(sub.notas ?? "");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Al cambiar de subtarea, sincroniza el textarea con sus notas.
  useEffect(() => { setNotas(sub.notas ?? ""); }, [sub.id]);

  async function guardarNotas() {
    setGuardandoNotas(true);
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}`, { method: "PATCH", body: JSON.stringify({ notas }) });
      showToast("Notas guardadas", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setGuardandoNotas(false);
    }
  }

  async function subirArchivo(file: File) {
    setSubiendo(true);
    try {
      const archivoBase64 = await fileToBase64(file);
      const partes = file.name.split(".");
      const extension = partes.length > 1 ? partes.pop()! : "bin";
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}/archivos`, {
        method: "POST",
        body: JSON.stringify({ nombre: file.name, extension, archivoBase64 }),
      });
      showToast("Documento adjuntado", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error al subir", "error");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function borrarArchivo(id: number) {
    try {
      await apiFetch(`/proyectos-empresa/subtareas/archivos/${id}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-neutral-900/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md z-[60] bg-white border-l border-neutral-200 shadow-2xl flex flex-col">
        <div className="shrink-0 flex items-start justify-between gap-3 p-5 border-b border-neutral-200">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Subtarea</p>
            <h3 className="text-base font-bold text-neutral-800 leading-snug mt-0.5">{sub.titulo}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Notas / observaciones */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">Notas y observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={6}
              placeholder="Observaciones del proyecto, contexto, pendientes…"
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={guardarNotas}
                disabled={guardandoNotas || notas === (sub.notas ?? "")}
                className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg cursor-pointer"
              >
                {guardandoNotas ? "Guardando…" : "Guardar notas"}
              </button>
            </div>
          </div>

          {/* Documentación adjunta */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">Documentación adjunta</label>
            {sub.archivos.length === 0 ? (
              <p className="text-xs text-neutral-400 italic mb-3">Sin documentos adjuntos.</p>
            ) : (
              <ul className="space-y-2 mb-3">
                {sub.archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 py-2">
                    <svg width="14" height="14" className="text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-orange-600 hover:underline truncate flex-1">{a.nombre}</a>
                    <span className="text-[10px] uppercase text-neutral-400">{a.extension}</span>
                    <button onClick={() => borrarArchivo(a.id)} className="text-neutral-300 hover:text-red-500 cursor-pointer shrink-0">
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirArchivo(f); }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-dashed border-neutral-300 text-neutral-600 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 px-3 py-2.5 rounded-lg cursor-pointer transition"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              {subiendo ? "Subiendo…" : "Adjuntar documento"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function AgregarSubtarea({ onAdd }: { onAdd: (titulo: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valor.trim()) { onAdd(valor); setValor(""); } }}
      className="pt-1"
    >
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="+ subtarea"
        className="w-full bg-white/60 border border-dashed border-neutral-300 rounded-lg px-2 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    </form>
  );
}

// ────────── Materiales / inventario asociado ──────────

function MaterialesPanel({ obra, puedeVerCostos, onChanged }: { obra: ObraDetalle; puedeVerCostos: boolean; onChanged: () => void }) {
  const [desc, setDesc] = useState("");
  const [cant, setCant] = useState("1");
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!desc.trim()) { showToast("Describe el material", "error"); return; }
    setGuardando(true);
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}/materiales`, {
        method: "POST",
        body: JSON.stringify({ items: [{ articuloDesc: desc.trim(), cantidad: Number(cant) || 1 }] }),
      });
      showToast("Solicitud de material enviada a Bodega", "success");
      setDesc(""); setCant("1");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-6 border-t border-neutral-100 pt-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Inventario asociado / solicitudes a Bodega</h4>
      {obra.solicitudes.length === 0 ? (
        <p className="text-xs text-neutral-400 italic mb-3">Aún no hay solicitudes de materiales para este proyecto.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {obra.solicitudes.map((sol) => (
            <div key={sol.id} className="border border-neutral-100 rounded-lg p-3 bg-neutral-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-600">Solicitud #{sol.id} · {sol.solicitante.nombre}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 uppercase">{fmtEstado(sol.estado)}</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-neutral-400">
                    <th className="py-1">Ítem</th>
                    <th className="py-1 w-16">Cant.</th>
                    {puedeVerCostos && <th className="py-1 w-24">Precio u.</th>}
                  </tr>
                </thead>
                <tbody>
                  {sol.items.map((it) => (
                    <tr key={it.id} className="border-t border-neutral-100">
                      <td className="py-1.5 text-neutral-700">{it.articuloDesc}{it.itemId && <span className="ml-1 text-[10px] text-emerald-600">(inventario)</span>}</td>
                      <td className="py-1.5 text-neutral-600">{it.cantidad}</td>
                      {puedeVerCostos && <td className="py-1.5 text-neutral-600">{it.precioUnitario ? clp.format(Number(it.precioUnitario)) : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-neutral-500 block mb-1.5">Nuevo material</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Controlador Auter A5…" className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div className="w-20">
          <label className="text-xs text-neutral-500 block mb-1.5">Cant.</label>
          <input type="number" min={1} value={cant} onChange={(e) => setCant(e.target.value)} className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <button onClick={agregar} disabled={guardando} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap">
          {guardando ? "…" : "Solicitar"}
        </button>
      </div>
    </div>
  );
}

// ────────── Reasignar responsables ──────────

function ReasignarModal({ obra, usuarios, onClose, onSaved }: { obra: ObraDetalle; usuarios: UsuarioConRol[]; onClose: () => void; onSaved: () => void }) {
  const [subgerenteId, setSubgerenteId] = useState(obra.subgerente?.id?.toString() ?? "");
  const [coordinadorId, setCoordinadorId] = useState(obra.coordinador?.id?.toString() ?? "");
  const [faseGlobal, setFaseGlobal] = useState(obra.faseGlobal);
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
  const jefes = usuarios.filter((u) => u.rol === "gerencia" || u.rol === "jefatura");
  const coords = usuarios.filter((u) => u.rol === "coordinador" || u.rol === "gerencia" || u.rol === "jefatura");

  async function guardar() {
    setSaving(true);
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}`, {
        method: "PATCH",
        body: JSON.stringify({ subgerenteId: subgerenteId || null, coordinadorId: coordinadorId || null, faseGlobal }),
      });
      showToast("Responsables actualizados", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Asignar responsables" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Subgerente / Jefe</label>
          <select value={subgerenteId} onChange={(e) => setSubgerenteId(e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {jefes.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Coordinador</label>
          <select value={coordinadorId} onChange={(e) => setCoordinadorId(e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {coords.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Fase global</label>
          <select value={faseGlobal} onChange={(e) => setFaseGlobal(e.target.value)} className={inputClass}>
            {FASES.map((f) => <option key={f} value={f}>{FASE_LABEL[f]}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ────────── Registrar hito ──────────

function HitoModal({ obraId, onClose, onSaved }: { obraId: number; onClose: () => void; onSaved: () => void }) {
  const [mensaje, setMensaje] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!mensaje.trim()) { showToast("Escribe el hito", "error"); return; }
    setSaving(true);
    try {
      await apiFetch(`/proyectos-empresa/${obraId}/bitacora`, { method: "POST", body: JSON.stringify({ mensaje: mensaje.trim() }) });
      showToast("Hito registrado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Registrar hito" onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Ej: Permiso municipal aprobado — folio 2026-0451"
          className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">{saving ? "Guardando…" : "Registrar"}</button>
        </div>
      </div>
    </Modal>
  );
}
