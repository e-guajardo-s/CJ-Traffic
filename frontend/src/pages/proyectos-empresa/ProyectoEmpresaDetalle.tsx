import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";
import ControlCostosModule from "./ControlCostosModule";
import GanttProyecto from "./GanttProyecto";
import GraficosProyecto from "./GraficosProyecto";
import ParteDiarioModule from "./ParteDiarioModule";
import { TIPOS_TRACK } from "./catalogos";
import { esGerencia, esJefatura, tieneRol } from "../../roles";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";

// ────────── Types ──────────

interface UsuarioLite { id: number; nombre: string; }
interface UsuarioConRol extends UsuarioLite { roles: string[]; }

type EstadoSubtarea = "POR_HACER" | "EN_PROGRESO" | "EN_REVISION" | "HECHO" | "BLOQUEADO";
type PrioridadSubtarea = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

interface SubtareaArchivo {
  id: number;
  nombre: string;
  url: string;
  extension: string;
}

interface SubtareaNota {
  id: number;
  autor: UsuarioLite;
  contenido: string;
  createdAt: string;
}

interface Subtarea {
  id: number;
  titulo: string;
  tipo: string | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  estado: EstadoSubtarea;
  prioridad: PrioridadSubtarea;
  orden: number;
  notas: string | null;
  asignado: UsuarioLite | null;
  fechaEstimadaDesbloqueo: string | null;
  updatedAt: string;
  archivos: SubtareaArchivo[];
  observaciones: SubtareaNota[];
}

interface ObraTrack {
  id: number;
  tipo: string;
  nombre: string | null;
  estadoActual: string;
  responsable?: UsuarioLite | null;
  ultimaActualizacion: string;
  subtareas: Subtarea[];
}

interface ObraBitacora {
  id: number;
  tipoEvento: string;
  mensaje: string;
  createdAt: string;
  autor: UsuarioLite;
}

interface CoordinadorExtra {
  id: number;
  coordinador: UsuarioLite;
  tipo: "TEMPORAL" | "PARALELO";
  vigenteHasta: string | null;
  createdAt: string;
}

interface ObraDetalle {
  id: number;
  codigoObra: string;
  nombre: string;
  cliente: string;
  tipoObra: string;
  tipoObraDetalle: string | null;
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
  coordinadoresExtra: CoordinadorExtra[];
}

// Coordinadores con autoridad plena en este momento: el principal + los
// co-coordinadores por transferencia temporal/paralela (el backend ya filtra
// los vencidos/inactivos al incluirlos en el GET, así que basta con listar ids).
function coordinadoresEfectivos(obra: Pick<ObraDetalle, "coordinador" | "coordinadoresExtra">): number[] {
  const ids = obra.coordinador ? [obra.coordinador.id] : [];
  return [...ids, ...obra.coordinadoresExtra.map((c) => c.coordinador.id)];
}

// Autoridad plena sobre una línea de trabajo: admin de la obra, coordinador
// efectivo del proyecto, o el responsable asignado a ESE track.
function puedeGestionarTrack(
  usuarioId: number | undefined,
  puedeAdministrar: boolean,
  obra: Pick<ObraDetalle, "coordinador" | "coordinadoresExtra">,
  track: Pick<ObraTrack, "responsable">,
): boolean {
  if (puedeAdministrar) return true;
  if (track.responsable?.id != null && track.responsable.id === usuarioId) return true;
  return !!usuarioId && coordinadoresEfectivos(obra).includes(usuarioId);
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
  ENLACES: { label: "Enlaces", nota: "Coordinación técnica" },
  EMPALMES: { label: "Empalmes", nota: "Conexiones físicas" },
  HITOS_UOCT: { label: "Hitos UOCT", nota: "Unidad Operativa de Control de Tránsito" },
  SINTONIA_FINA: { label: "Sintonía Fina", nota: "Ajuste de tiempos" },
  TRASPASOS_MANTENCION: { label: "Traspasos y Mantención", nota: "Entrega a Servicio Técnico" },
  CANALIZACION: { label: "Canalización", nota: "Terreno" },
  OBRAS_CIVILES: { label: "Obras Civiles", nota: "Terreno" },
  OTRO: { label: "Otro" },
};

// Etiqueta a mostrar para una línea de trabajo: si es personalizada ("OTRO")
// usa el nombre libre que el usuario escribió al crearla.
function labelTrack(track: { tipo: string; nombre: string | null }): string {
  if (track.tipo === "OTRO") return track.nombre || "Otro";
  return TRACK_META[track.tipo]?.label ?? track.tipo;
}

// Estado operativo del track: desde la Fase 2 se deriva automáticamente en el
// backend a partir de las subtareas (NO_INICIADO/EN_CURSO/COMPLETADO/BLOQUEADO),
// pero tracks que no han tenido cambios desde antes de esa fase conservan valores
// manuales legacy (APROBADO, EN_TERRENO, ESPERANDO_REQUERIMIENTOS, PLANIFICACION,
// etc.) hasta que alguna de sus subtareas cambie de estado. En vez de mapear cada
// string posible uno a uno, se clasifica por cuánto avance representa — así
// cualquier valor legacy no listado cae en un balde razonable por defecto.
const TRACK_ESTADO_LABEL: Record<string, string> = {
  NO_INICIADO: "No iniciado",
  EN_CURSO: "En curso",
  COMPLETADO: "Completado",
  BLOQUEADO: "Bloqueado",
};

type EstadoTrackBucket = "NO_INICIADO" | "EN_CURSO" | "ESPERANDO" | "CASI_COMPLETO" | "COMPLETADO" | "BLOQUEADO";

const BUCKET_LABEL: Record<EstadoTrackBucket, string> = {
  NO_INICIADO: "No iniciado",
  EN_CURSO: "En curso",
  ESPERANDO: "Esperando",
  CASI_COMPLETO: "Casi completo",
  COMPLETADO: "Completado",
  BLOQUEADO: "Bloqueado",
};
const BUCKET_ESTILO: Record<EstadoTrackBucket, string> = {
  NO_INICIADO: "bg-neutral-100 text-neutral-600 border-neutral-200",
  EN_CURSO: "bg-sky-100 text-sky-700 border-sky-200",
  ESPERANDO: "bg-amber-100 text-amber-700 border-amber-200",
  CASI_COMPLETO: "bg-teal-100 text-teal-700 border-teal-200",
  COMPLETADO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  BLOQUEADO: "bg-red-100 text-red-700 border-red-200",
};

function clasificarEstadoTrack(estadoActual: string): EstadoTrackBucket {
  const e = estadoActual.toUpperCase();
  if (e.startsWith("BLOQUEADO")) return "BLOQUEADO";
  if (e.includes("ESPERANDO")) return "ESPERANDO";
  if (["COMPLETADO", "FINALIZADO", "DESPACHADO", "RECIBIDO", "CERRADO"].some((s) => e.includes(s))) return "COMPLETADO";
  if (["APROBADO", "TERRENO", "REVISION", "REVISADO"].some((s) => e.includes(s))) return "CASI_COMPLETO";
  if (["EN_CURSO", "TRAMITE", "PROCESO", "COTIZANDO", "ORDEN_COMPRA"].some((s) => e.includes(s))) return "EN_CURSO";
  return "NO_INICIADO"; // NO_INICIADO, POR_INICIAR, PLANIFICACION y cualquier otro valor no reconocido
}

// Iconos de línea (mismo estilo que el resto de la app), sin emojis.
function TrackIcon({ tipo, className = "w-4 h-4" }: { tipo: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    PERMISOS: <><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M9 3v6h6" /><path d="M9 3l6 6" /></>,
    ADQUISICIONES: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
    PROGRAMACION: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></>,
    INSTALACION: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    COMUNICACIONES: <><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></>,
    ENLACES: <><circle cx="6" cy="12" r="2" /><circle cx="18" cy="12" r="2" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /></>,
    EMPALMES: <><line x1="6" y1="6" x2="12" y2="12" /><line x1="18" y1="6" x2="12" y2="12" /><line x1="12" y1="12" x2="18" y2="18" /><line x1="12" y1="12" x2="6" y2="18" /></>,
    HITOS_UOCT: <><path d="M12 2 4 7v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7z" /><path d="m9 12 2 2 4-4" /></>,
    SINTONIA_FINA: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>,
    TRASPASOS_MANTENCION: <><path d="M17 2 21 6l-4 4" /><path d="M3 12v-2a4 4 0 0 1 4-4h14" /><path d="M7 22 3 18l4-4" /><path d="M21 12v2a4 4 0 0 1-4 4H3" /></>,
    CANALIZACION: <><path d="M3 8h6a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h6" /><circle cx="5" cy="8" r="2" /><circle cx="19" cy="16" r="2" /></>,
    OBRAS_CIVILES: <><path d="M3 21h18" /><path d="M5 21V10l7-6 7 6v11" /><path d="M10 21v-6h4v6" /></>,
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
  { estado: "BLOQUEADO", label: "Bloqueado" },
];
const PRIORIDADES: { id: PrioridadSubtarea; label: string }[] = [
  { id: "BAJA", label: "Baja" },
  { id: "MEDIA", label: "Media" },
  { id: "ALTA", label: "Alta" },
  { id: "URGENTE", label: "Urgente" },
];

// Clases Tailwind completas (no strings dinámicos) por prioridad, para franja
// izquierda de la card, badge y select del drawer.
const PRIORIDAD_ESTILO: Record<PrioridadSubtarea, { borde: string; badge: string; punto: string }> = {
  BAJA: { borde: "border-l-neutral-300", badge: "bg-neutral-100 text-neutral-600 border-neutral-200", punto: "bg-neutral-400" },
  MEDIA: { borde: "border-l-sky-400", badge: "bg-sky-50 text-sky-700 border-sky-200", punto: "bg-sky-500" },
  ALTA: { borde: "border-l-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", punto: "bg-amber-500" },
  URGENTE: { borde: "border-l-red-500", badge: "bg-red-50 text-red-700 border-red-200", punto: "bg-red-500" },
};

// Iniciales de un nombre completo, para el avatar circular del asignado.
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Paleta fija (clases Tailwind completas, no strings dinámicos) para distinguir
// visualmente a cada usuario por su id — mismo color en toda la app.
const PALETA_USUARIOS = [
  "bg-orange-500 text-white",
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
  "bg-cyan-500 text-white",
  "bg-fuchsia-500 text-white",
] as const;

function colorUsuario(id: number): string {
  return PALETA_USUARIOS[id % PALETA_USUARIOS.length];
}

function UsuarioAvatar({ usuario, className = "w-6 h-6 text-[10px]" }: { usuario: UsuarioLite; className?: string }) {
  return (
    <span
      title={usuario.nombre}
      className={`shrink-0 rounded-full font-bold flex items-center justify-center ${colorUsuario(usuario.id)} ${className}`}
    >
      {iniciales(usuario.nombre)}
    </span>
  );
}

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function fmtEstado(s: string) {
  return s.replaceAll("_", " ");
}

// ────────── Main component ──────────

export default function ProyectoEmpresaDetalle() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const puedeAdministrar = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);
  const puedeVerCostos = puedeAdministrar;

  const [obra, setObra] = useState<ObraDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);

  // El coordinador asignado no ve todos los costos (montoContrato, EPs), pero
  // puede editar precios de ítems de presupuesto de sus propios subcontratos
  // — necesita entrar a la pestaña de Control de Costos para eso.
  const esCoordinadorAsignado = tieneRol(usuario?.roles, "coordinador") && usuario?.id === obra?.coordinador?.id;
  const puedeVerControlCostos = puedeVerCostos || esCoordinadorAsignado;
  // Coordinador efectivo: el principal o un co-coordinador por transferencia
  // temporal/paralela vigente. Tiene autoridad sobre TODAS las líneas de
  // trabajo del proyecto (no solo las que ya tienen responsable asignado).
  const esCoordinadorEfectivoObra = !!obra && !!usuario?.id && coordinadoresEfectivos(obra).includes(usuario.id);
  const puedeAgregarLineas = puedeAdministrar || esCoordinadorEfectivoObra;

  const [reasignando, setReasignando] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const [registrandoHito, setRegistrandoHito] = useState(false);
  // Al volver desde el kanban de una línea de trabajo, aterriza en "Tareas" (de
  // donde se entró), no en "Vista General" — se señaliza vía location.state.
  const [activeTab, setActiveTab] = useState<"general" | "tareas" | "costos" | "gantt" | "diario">(
    (location.state?.initialTab as "tareas" | undefined) ?? "general"
  );
  const [filtroEstadoTrack, setFiltroEstadoTrack] = useState<EstadoTrackBucket | "">("");
  const [agregandoTrack, setAgregandoTrack] = useState(false);

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

  // Eliminar un tablero es irreversible (se pierden todas sus tareas/notas/
  // adjuntos) y solo gerencia puede ejecutarlo en el backend — acá se exige
  // además doble confirmación explícita antes de llamar al endpoint.
  async function eliminarTablero(track: { id: number; tipo: string; nombre: string | null }) {
    const label = labelTrack(track);
    if (!confirm(`¿Eliminar el tablero "${label}"? Se perderán todas sus tareas, notas y documentos adjuntos.`)) return;
    if (!confirm(`Esta acción es irreversible y no se puede deshacer. Confirma nuevamente para eliminar "${label}".`)) return;
    try {
      await apiFetch(`/proyectos-empresa/tracks/${track.id}`, { method: "DELETE" });
      showToast("Tablero eliminado", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar el tablero", "error");
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
              <strong>{obra.codigoObra}</strong> — Cliente: {obra.cliente} ({obra.tipoObra === "OTRO" ? (obra.tipoObraDetalle || "Otro") : fmtEstado(obra.tipoObra)})
            </p>

            <div className="flex items-center gap-6 flex-wrap mt-4 text-xs text-neutral-500">
              {/* El campo de subgerente ha sido removido temporalmente por indicación (siempre Javier) */}
              <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                <span className="font-semibold text-neutral-700">Coord:</span> {obra.coordinador?.nombre ?? "No asignado"}
              </span>
              {obra.coordinadoresExtra.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100 text-sky-700">
                  <span className="font-semibold">{c.tipo === "TEMPORAL" ? "Temporal:" : "Paralelo:"}</span> {c.coordinador.nombre}
                  {c.vigenteHasta && ` (hasta ${new Date(c.vigenteHasta).toLocaleDateString("es-CL")})`}
                </span>
              ))}
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
            {(puedeAdministrar || usuario?.id === obra.coordinador?.id) && (
              <button onClick={() => setReasignando(true)} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
                {puedeAdministrar ? "Editar responsables / Fase" : "Editar Fase"}
              </button>
            )}
            {(puedeAdministrar || usuario?.id === obra.coordinador?.id) && (
              <button onClick={() => setTransfiriendo(true)} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
                Transferir proyecto
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

        {/* Pestañas */}
        <div className="flex border-b border-neutral-200 mt-8">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === "general" ? "border-b-2 border-orange-500 text-orange-600" : "text-neutral-500 hover:text-neutral-700"}`}
          >
            Vista General
          </button>
          <button
            onClick={() => setActiveTab("tareas")}
            className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === "tareas" ? "border-b-2 border-orange-500 text-orange-600" : "text-neutral-500 hover:text-neutral-700"}`}
          >
            Tareas
          </button>
          {puedeVerControlCostos && (
            <button
              onClick={() => setActiveTab("costos")}
              className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === "costos" ? "border-b-2 border-orange-500 text-orange-600" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              Control de Costos
            </button>
          )}
          {puedeVerControlCostos && (
            <button
              onClick={() => setActiveTab("gantt")}
              className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === "gantt" ? "border-b-2 border-orange-500 text-orange-600" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              Carta Gantt
            </button>
          )}
          <button
            onClick={() => setActiveTab("diario")}
            className={`px-4 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === "diario" ? "border-b-2 border-orange-500 text-orange-600" : "text-neutral-500 hover:text-neutral-700"}`}
          >
            Parte Diario
          </button>
        </div>
      </div>

      {(activeTab === "general" || activeTab === "tareas") && (
        <AlertasBloqueoBanner obra={obra} onIrATrack={(trackId) => navigate(`/proyectos_empresa/detalle/${obra.id}/track/${trackId}`)} />
      )}

      {activeTab === "costos" ? (
        <div className="-mx-8">
          <ControlCostosModule obraId={obra.id} esCoordinadorAsignado={esCoordinadorAsignado} />
        </div>
      ) : activeTab === "gantt" ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <GanttProyecto obra={obra} onChanged={cargar} />
        </div>
      ) : activeTab === "diario" ? (
        <ParteDiarioModule obraId={obra.id} obraNombre={obra.nombre} obraCodigo={obra.codigoObra} tracks={obra.tracks} />
      ) : activeTab === "tareas" ? (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Líneas de trabajo (haz clic para abrir su tablero)</h3>
            {puedeAgregarLineas && (
              <button
                onClick={() => setAgregandoTrack(true)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Agregar línea de trabajo
              </button>
            )}
          </div>

          {/* Filtro por estado (clasificado por avance, no por el string exacto) */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button
              onClick={() => setFiltroEstadoTrack("")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${!filtroEstadoTrack ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
            >
              Todos ({obra.tracks.length})
            </button>
            {(Object.keys(BUCKET_LABEL) as EstadoTrackBucket[]).map((bucket) => {
              const count = obra.tracks.filter((t) => clasificarEstadoTrack(t.estadoActual) === bucket).length;
              if (count === 0) return null;
              const activo = filtroEstadoTrack === bucket;
              return (
                <button
                  key={bucket}
                  onClick={() => setFiltroEstadoTrack(activo ? "" : bucket)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? BUCKET_ESTILO[bucket] : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                >
                  {BUCKET_LABEL[bucket]} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {obra.tracks.filter((t) => !filtroEstadoTrack || clasificarEstadoTrack(t.estadoActual) === filtroEstadoTrack).map((track) => {
              const meta = { label: labelTrack(track), nota: TRACK_META[track.tipo]?.nota };
              const total = track.subtareas.length;
              const hechas = track.subtareas.filter((s) => s.estado === "HECHO").length;
              return (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/proyectos_empresa/detalle/${obra.id}/track/${track.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/proyectos_empresa/detalle/${obra.id}/track/${track.id}`); }}
                  className="relative text-left bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:border-orange-300 hover:shadow transition cursor-pointer group"
                >
                  {esGerencia(usuario?.roles) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); eliminarTablero(track); }}
                      title="Eliminar tablero"
                      className="absolute top-3 right-3 text-neutral-300 hover:text-red-500 transition cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-2 pr-5">
                    <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                      <span className="text-neutral-400"><TrackIcon tipo={track.tipo} /></span> {meta.label}
                    </h4>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${BUCKET_ESTILO[clasificarEstadoTrack(track.estadoActual)]}`}>
                      {TRACK_ESTADO_LABEL[track.estadoActual] ?? fmtEstado(track.estadoActual)}
                    </span>
                  </div>
                  {meta.nota && <p className="text-[11px] text-neutral-400 mt-1">{meta.nota}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      {track.responsable ? (
                        <>
                          <UsuarioAvatar usuario={track.responsable} className="w-5 h-5 text-[9px]" />
                          <span className="font-semibold text-neutral-700">{track.responsable.nombre}</span>
                        </>
                      ) : (
                        <span className="text-amber-600 font-semibold">Sin coordinador asignado</span>
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-neutral-500">{hechas}/{total} subtareas</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all ${clasificarEstadoTrack(track.estadoActual) === "BLOQUEADO" ? "bg-red-400" : "bg-emerald-500"}`}
                      style={{ width: `${total > 0 ? (hechas / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <GraficosProyecto obra={obra} />

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
                      <UsuarioAvatar usuario={b.autor} className="w-8 h-8 text-xs" />
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
                <p className="text-[11px] text-neutral-400 mt-3">Se alimenta de las solicitudes de materiales y de los Estados de Pago pagados en los Subcontratos.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modales */}
      {reasignando && (
        <ReasignarModal obra={obra} usuarios={usuarios} onClose={() => setReasignando(false)} onSaved={() => { setReasignando(false); cargar(); }} />
      )}
      {transfiriendo && (
        <TransferirProyectoModal obra={obra} usuarios={usuarios} onClose={() => setTransfiriendo(false)} onSaved={() => { setTransfiriendo(false); cargar(); }} />
      )}
      {registrandoHito && (
        <HitoModal obraId={obra.id} onClose={() => setRegistrandoHito(false)} onSaved={() => { setRegistrandoHito(false); cargar(); }} />
      )}
      {agregandoTrack && (
        <AgregarTrackModal obraId={obra.id} tiposExistentes={obra.tracks.map((t) => t.tipo)} onClose={() => setAgregandoTrack(false)} onSaved={() => { setAgregandoTrack(false); cargar(); }} />
      )}
    </div>
  );
}

// ────────── Modal: agregar una línea de trabajo (track) a una obra existente ──────────

function AgregarTrackModal({ obraId, tiposExistentes, onClose, onSaved }: { obraId: number; tiposExistentes: string[]; onClose: () => void; onSaved: () => void }) {
  const yaTiene = new Set(tiposExistentes);
  const [tracksSeleccionados, setTracksSeleccionados] = useState<Set<string>>(new Set());
  const [tracksPersonalizados, setTracksPersonalizados] = useState<string[]>([]);
  const [nuevoPersonalizado, setNuevoPersonalizado] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleTrack(code: string) {
    setTracksSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function agregarPersonalizado() {
    const v = nuevoPersonalizado.trim();
    if (!v) return;
    setTracksPersonalizados((prev) => [...prev, v]);
    setNuevoPersonalizado("");
  }
  function quitarPersonalizado(i: number) {
    setTracksPersonalizados((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = tracksSeleccionados.size + tracksPersonalizados.length;

  async function guardar() {
    if (total === 0) {
      showToast("Selecciona al menos una línea de trabajo", "error");
      return;
    }
    setSaving(true);
    try {
      for (const tipo of tracksSeleccionados) {
        await apiFetch(`/proyectos-empresa/${obraId}/tracks`, { method: "POST", body: JSON.stringify({ tipo, nombre: null }) });
      }
      for (const nombre of tracksPersonalizados) {
        await apiFetch(`/proyectos-empresa/${obraId}/tracks`, { method: "POST", body: JSON.stringify({ tipo: "OTRO", nombre }) });
      }
      showToast(total === 1 ? "Línea de trabajo agregada" : `${total} líneas de trabajo agregadas`, "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al agregar la línea de trabajo", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Agregar línea de trabajo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">
            Líneas de trabajo <span className="text-neutral-400 font-normal">(haz clic para incluirlas)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_TRACK.filter((t) => t.code !== "OTRO" && !yaTiene.has(t.code)).map((t) => {
              const activo = tracksSeleccionados.has(t.code);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggleTrack(t.code)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                >
                  {activo && "✓ "}{t.label}
                </button>
              );
            })}
            {TIPOS_TRACK.filter((t) => t.code !== "OTRO" && !yaTiene.has(t.code)).length === 0 && (
              <p className="text-xs text-neutral-400 italic">Ya agregaste todas las líneas predefinidas.</p>
            )}
          </div>

          {tracksPersonalizados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tracksPersonalizados.map((nombreTrack, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-orange-100 border-orange-300 text-orange-700">
                  {nombreTrack}
                  <button type="button" onClick={() => quitarPersonalizado(i)} className="text-orange-500 hover:text-red-600 cursor-pointer">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <input
              value={nuevoPersonalizado}
              onChange={(e) => setNuevoPersonalizado(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarPersonalizado(); } }}
              placeholder="Otra línea (nombre libre)…"
              className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
            <button
              type="button"
              onClick={agregarPersonalizado}
              disabled={!nuevoPersonalizado.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              + Agregar
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button onClick={onClose} disabled={saving} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving || total === 0} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {saving ? "Agregando…" : total > 1 ? `Agregar ${total} líneas` : "Agregar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ────────── Banner de alertas: tareas bloqueadas en cualquier línea de trabajo ──────────

function AlertasBloqueoBanner({ obra, onIrATrack }: { obra: ObraDetalle; onIrATrack: (trackId: number) => void }) {
  const bloqueadas = obra.tracks.flatMap((track) =>
    track.subtareas
      .filter((s) => s.estado === "BLOQUEADO")
      .map((subtarea) => ({ trackId: track.id, trackLabel: labelTrack(track), subtarea }))
  );
  if (bloqueadas.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-600">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
          {bloqueadas.length} {bloqueadas.length === 1 ? "tarea bloqueada" : "tareas bloqueadas"}
        </h3>
      </div>
      <ul className="space-y-2">
        {bloqueadas.map(({ trackId, trackLabel, subtarea }) => (
          <li key={subtarea.id} className="flex items-center justify-between gap-3 bg-white border border-red-100 rounded-lg px-3 py-2">
            <span className="text-xs text-neutral-700">
              <strong className="text-neutral-800">{subtarea.titulo}</strong>
              <span className="text-neutral-400"> — {trackLabel}</span>
              {subtarea.fechaEstimadaDesbloqueo && (
                <span className="text-red-600 font-semibold"> · Desbloquea {new Date(subtarea.fechaEstimadaDesbloqueo).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}</span>
              )}
            </span>
            <button onClick={() => onIrATrack(trackId)} className="text-xs font-bold text-red-600 hover:text-red-800 shrink-0 cursor-pointer">
              Ver →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────── Vista del track (ruta propia, dentro del layout con header + sidebar) ──────────

export function TrackVista() {
  const { proyectoId, trackId } = useParams();
  const location = useLocation();
  const initialSubtareaId = location.state?.openSubtareaId as number | undefined;

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
        <Link to={`/proyectos_empresa/detalle/${obra.id}`} state={{ initialTab: "tareas" }} className="text-xs font-semibold text-orange-600 hover:underline">Volver al proyecto</Link>
      </div>
    );
  }

  return <TrackVistaContenido track={track} obra={obra} usuarios={usuarios} onChanged={cargar} initialSubtareaId={initialSubtareaId} />;
}

function TrackVistaContenido({
  track, obra, usuarios, onChanged, initialSubtareaId
}: {
  track: ObraTrack;
  obra: ObraDetalle;
  usuarios: UsuarioConRol[];
  onChanged: () => void;
  initialSubtareaId?: number;
}) {
  const { usuario } = useAuth();
  const puedeAdminObra = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);
  const esCoordinadorEfectivo = !!usuario?.id && coordinadoresEfectivos(obra).includes(usuario.id);
  const puedeAsignarResponsable = puedeAdminObra || esCoordinadorEfectivo;
  const puedeGestionar = puedeGestionarTrack(usuario?.id, puedeAdminObra, obra, track);
  const esMiTarea = (sub: Pick<Subtarea, "asignado">) => track.responsable != null && sub.asignado?.id === usuario?.id;

  const meta = { label: labelTrack(track), nota: TRACK_META[track.tipo]?.nota };
  const [responsableId, setResponsableId] = useState<string>(track.responsable?.id?.toString() ?? "");
  const [guardandoCab, setGuardandoCab] = useState(false);
  const [subSel, setSubSel] = useState<number | null>(initialSubtareaId ?? null);
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadSubtarea | "">("");
  const [filtroAsignadoId, setFiltroAsignadoId] = useState("");
  const [ordenarPorFecha, setOrdenarPorFecha] = useState(false);

  const total = track.subtareas.length;
  const hechas = track.subtareas.filter((s) => s.estado === "HECHO").length;
  const subActiva = track.subtareas.find((s) => s.id === subSel) ?? null;

  const subtareasFiltradas = track.subtareas
    .filter((s) => !filtroPrioridad || s.prioridad === filtroPrioridad)
    .filter((s) => !filtroAsignadoId || s.asignado?.id.toString() === filtroAsignadoId);
  const hayFiltrosActivos = !!filtroPrioridad || !!filtroAsignadoId;

  async function guardarResponsable() {
    setGuardandoCab(true);
    try {
      await apiFetch(`/proyectos-empresa/tracks/${track.id}`, {
        method: "PATCH",
        body: JSON.stringify({ responsableId: responsableId || null }),
      });
      showToast("Responsable actualizado", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setGuardandoCab(false);
    }
  }

  async function agregarSub(estadoCol: EstadoSubtarea, titulo: string, tipo: string, fechaVencimiento: string, prioridad: PrioridadSubtarea) {
    if (!titulo.trim()) return;
    try {
      await apiFetch(`/proyectos-empresa/tracks/${track.id}/subtareas`, {
        method: "POST",
        body: JSON.stringify({ titulo: titulo.trim(), estado: estadoCol, tipo: tipo || null, fechaVencimiento: fechaVencimiento || null, prioridad }),
      });
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  // Drag & drop: mueve una subtarea a otra columna (estado), al final de esa columna.
  const [colArrastrando, setColArrastrando] = useState<EstadoSubtarea | null>(null);
  const [subArrastrandoId, setSubArrastrandoId] = useState<number | null>(null);
  // Mover a Bloqueado exige capturar fecha estimada de desbloqueo (+ motivo opcional)
  // antes del PATCH, así que se intercepta con un mini-modal en vez de mover directo.
  const [bloqueandoSub, setBloqueandoSub] = useState<Subtarea | null>(null);

  async function moverAEstado(subId: number, destino: EstadoSubtarea) {
    const sub = track.subtareas.find((s) => s.id === subId);
    if (!sub || sub.estado === destino) return;
    if (destino === "BLOQUEADO") {
      setBloqueandoSub(sub);
      return;
    }
    const maxOrden = Math.max(-1, ...track.subtareas.filter((s) => s.estado === destino).map((s) => s.orden));
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${subId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: destino, orden: maxOrden + 1 }),
      });
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    }
  }

  async function confirmarBloqueo(fechaEstimadaDesbloqueo: string, motivo: string) {
    if (!bloqueandoSub) return;
    const maxOrden = Math.max(-1, ...track.subtareas.filter((s) => s.estado === "BLOQUEADO").map((s) => s.orden));
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${bloqueandoSub.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "BLOQUEADO", fechaEstimadaDesbloqueo, orden: maxOrden + 1 }),
      });
      if (motivo.trim()) {
        await apiFetch(`/proyectos-empresa/subtareas/${bloqueandoSub.id}/observaciones`, {
          method: "POST",
          body: JSON.stringify({ contenido: `Motivo del bloqueo: ${motivo.trim()}` }),
        });
      }
      showToast("Tarea bloqueada", "success");
      setBloqueandoSub(null);
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
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link to={`/proyectos_empresa/detalle/${obra.id}`} state={{ initialTab: "tareas" }} className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 hover:bg-orange-100 text-neutral-500 hover:text-orange-600 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-orange-500"><TrackIcon tipo={track.tipo} className="w-5 h-5" /></span>
                <h2 className="text-lg font-black text-neutral-800 uppercase tracking-tight">{meta.label}</h2>
              </div>
              <p className="text-xs font-medium text-neutral-400 mt-0.5">{obra.nombre} · {obra.codigoObra}</p>
            </div>
          </div>
          
          {/* Progress Pill */}
          <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2 rounded-lg border border-neutral-100">
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Avance del Track</span>
              <span className="text-sm font-black text-neutral-700">{hechas}/{total} <span className="text-xs font-medium text-neutral-400">tareas</span></span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-neutral-200 flex items-center justify-center relative overflow-hidden bg-white">
              <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-500" style={{ height: `${total > 0 ? (hechas/total)*100 : 0}%` }} />
              <span className="relative z-10 text-[10px] font-bold text-neutral-700 mix-blend-hard-light">{total > 0 ? Math.round((hechas/total)*100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Toolbar: estado (automático, solo lectura) + responsable del track */}
        <div className="flex flex-col gap-4 pt-4 border-t border-neutral-100">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Estado Operativo del Track</label>
              <div className="h-[38px] flex items-center">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${BUCKET_ESTILO[clasificarEstadoTrack(track.estadoActual)]}`}>
                  {TRACK_ESTADO_LABEL[track.estadoActual] ?? fmtEstado(track.estadoActual)}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">Se calcula automáticamente según el estado de sus tareas.</p>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Responsable Asignado</label>
              {puedeAsignarResponsable ? (
                <select
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  className="w-full bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                >
                  <option value="">Sin responsable asignado</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              ) : (
                <div className="h-[38px] flex items-center text-sm font-semibold text-neutral-700">
                  {track.responsable?.nombre ?? <span className="text-amber-600">Sin coordinador asignado</span>}
                </div>
              )}
            </div>
            {puedeAsignarResponsable && (
            <button
              onClick={guardarResponsable}
              disabled={guardandoCab || responsableId === (track.responsable?.id?.toString() ?? "")}
              className="text-sm font-bold bg-neutral-800 hover:bg-black disabled:bg-neutral-300 disabled:text-neutral-500 text-white px-5 py-2 rounded-lg cursor-pointer transition-all shadow-sm h-[38px]"
            >
              {guardandoCab ? "Guardando…" : "Actualizar Responsable"}
            </button>
            )}
          </div>
        </div>
      </div>

      {!track.responsable && !puedeGestionar && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          Esta línea de trabajo aún no tiene coordinador asignado. Solo el subgerente o un coordinador del proyecto puede asignarlo y habilitar el tablero.
        </div>
      )}

      {/* Filtros del kanban */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-neutral-200 rounded-xl px-4 py-2.5">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Filtrar</span>
        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as PrioridadSubtarea | "")}
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select
          value={filtroAsignadoId}
          onChange={(e) => setFiltroAsignadoId(e.target.value)}
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todos los asignados</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <button
          onClick={() => setOrdenarPorFecha((v) => !v)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer transition ${ordenarPorFecha ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"}`}
        >
          Ordenar por vencimiento
        </button>
        {hayFiltrosActivos && (
          <button
            onClick={() => { setFiltroPrioridad(""); setFiltroAsignadoId(""); }}
            className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 cursor-pointer ml-auto"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Kanban (scroll horizontal dentro del contenido) */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 items-start min-w-max">
          {COLUMNAS.map((col) => {
            let items = subtareasFiltradas.filter((s) => s.estado === col.estado).sort((a, b) => a.orden - b.orden);
            if (ordenarPorFecha) {
              items = [...items].sort((a, b) => {
                if (!a.fechaVencimiento) return 1;
                if (!b.fechaVencimiento) return -1;
                return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
              });
            }
            const esDestinoActivo = colArrastrando === col.estado;
            const esColBloqueado = col.estado === "BLOQUEADO";
            return (
              <div
                key={col.estado}
                onDragOver={(e) => { e.preventDefault(); setColArrastrando(col.estado); }}
                onDragLeave={() => setColArrastrando((c) => (c === col.estado ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  const subId = Number(e.dataTransfer.getData("text/plain"));
                  setColArrastrando(null);
                  if (subId) moverAEstado(subId, col.estado);
                }}
                className={`w-[300px] shrink-0 border rounded-2xl flex flex-col transition-colors ${
                  esDestinoActivo ? "bg-orange-50 border-orange-300"
                  : esColBloqueado ? "bg-red-50/60 border-red-200"
                  : "bg-neutral-50/70 border-neutral-200"
                }`}
              >
                <div className={`flex items-center justify-between px-3 py-3 border-b ${esColBloqueado ? "border-red-200" : "border-neutral-200"}`}>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${esColBloqueado ? "text-red-500" : "text-neutral-500"}`}>{col.label}</span>
                  <span className="text-xs font-semibold text-neutral-600 bg-neutral-200 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="p-3 space-y-3 min-h-[240px] flex-1">
                  {items.map((sub) => {
                    const estilo = PRIORIDAD_ESTILO[sub.prioridad];
                    const puedeMover = puedeGestionar || esMiTarea(sub);
                    return (
                      <div
                        key={sub.id}
                        draggable={puedeMover}
                        onDragStart={(e) => { if (!puedeMover) { e.preventDefault(); return; } setSubArrastrandoId(sub.id); e.dataTransfer.setData("text/plain", String(sub.id)); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => setSubArrastrandoId(null)}
                        onClick={() => setSubSel(sub.id)}
                        className={`bg-white border border-l-4 border-neutral-200 ${estilo.borde} rounded-xl p-3.5 shadow-sm group transition-all hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 ${puedeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${subArrastrandoId === sub.id ? "opacity-30 border-dashed" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold leading-snug transition-colors ${sub.estado === "HECHO" ? "line-through text-neutral-400" : "text-neutral-800 group-hover:text-orange-600"}`}>{sub.titulo}</p>
                          {sub.asignado && (
                            <UsuarioAvatar usuario={sub.asignado} className="w-5 h-5 text-[9px]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-50 text-[10px] text-neutral-400 flex-wrap">
                          {(sub.prioridad === "ALTA" || sub.prioridad === "URGENTE") && (
                            <span className={`px-1.5 py-0.5 rounded border font-bold uppercase ${estilo.badge}`}>
                              {sub.prioridad === "URGENTE" ? "Urgente" : "Alta"}
                            </span>
                          )}
                          {sub.tipo && (
                            <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200 font-medium">
                              {sub.tipo}
                            </span>
                          )}
                          {sub.fechaVencimiento && (
                            <span className={`flex items-center gap-0.5 ${new Date(sub.fechaVencimiento) < new Date() && sub.estado !== "HECHO" ? "text-red-500 font-bold" : ""}`}>
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              {new Date(sub.fechaVencimiento).toLocaleDateString("es-CL", { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          {sub.estado === "BLOQUEADO" && sub.fechaEstimadaDesbloqueo && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border font-bold bg-red-100 text-red-700 border-red-200">
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                              Desbloquea {new Date(sub.fechaEstimadaDesbloqueo).toLocaleDateString("es-CL", { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          {sub.archivos.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                              {sub.archivos.length}
                            </span>
                          )}
                          {sub.observaciones && sub.observaciones.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
                              {sub.observaciones.length}
                            </span>
                          )}
                          {puedeGestionar && (
                            <button onClick={(e) => { e.stopPropagation(); borrarSub(sub); }} className="ml-auto opacity-0 group-hover:opacity-100 transition text-neutral-300 hover:text-red-500 cursor-pointer">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!esColBloqueado && puedeGestionar && (
                    <AgregarSubtarea onAdd={(tit, tip, fec, prio) => agregarSub(col.estado, tit, tip, fec, prio)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel lateral de la subtarea (notas + adjuntos) */}
      {subActiva && (
        <SubtareaDrawer sub={subActiva} track={track} obra={obra} usuarios={usuarios} onClose={() => setSubSel(null)} onChanged={onChanged} />
      )}

      {bloqueandoSub && (
        <BloquearTareaModal
          titulo={bloqueandoSub.titulo}
          onClose={() => setBloqueandoSub(null)}
          onConfirm={confirmarBloqueo}
        />
      )}
    </div>
  );
}

// ────────── Mini-modal: bloquear una tarea (fecha estimada de desbloqueo + motivo) ──────────

function BloquearTareaModal({ titulo, onClose, onConfirm }: { titulo: string; onClose: () => void; onConfirm: (fecha: string, motivo: string) => Promise<void> }) {
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!fecha) return;
    setGuardando(true);
    try {
      await onConfirm(fecha, motivo);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={`Bloquear "${titulo}"`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Fecha estimada de desbloqueo *</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Motivo del bloqueo (opcional, queda como observación)</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="¿Por qué se está bloqueando esta tarea?"
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={confirmar} disabled={guardando || !fecha} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {guardando ? "Bloqueando…" : "Bloquear tarea"}
          </button>
        </div>
      </div>
    </Modal>
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

function SubtareaDrawer({
  sub, track, obra, usuarios, onClose, onChanged
}: {
  sub: Subtarea;
  track: ObraTrack;
  obra: ObraDetalle;
  usuarios: UsuarioConRol[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { usuario } = useAuth();
  const puedeAdminObra = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);
  // Edición completa (título, prioridad, asignado, fechas, descripción): solo
  // quien gestiona la línea de trabajo. El trabajador asignado únicamente
  // puede mover el estado de SU propia tarea (igual que el drag & drop).
  const puedeEditarCompleto = puedeGestionarTrack(usuario?.id, puedeAdminObra, obra, track);
  const puedeMoverEstado = puedeEditarCompleto || (track.responsable != null && sub.asignado?.id === usuario?.id);
  const [nuevaNota, setNuevaNota] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detalle editable de la subtarea (título, estado, prioridad, tipo, asignado, fechas, descripción).
  const [titulo, setTitulo] = useState(sub.titulo);
  const [estado, setEstado] = useState<EstadoSubtarea>(sub.estado);
  const [prioridad, setPrioridad] = useState<PrioridadSubtarea>(sub.prioridad);
  const [tipo, setTipo] = useState(sub.tipo ?? "");
  const [asignadoId, setAsignadoId] = useState(sub.asignado?.id?.toString() ?? "");
  const [fechaInicio, setFechaInicio] = useState(sub.fechaInicio?.slice(0, 10) ?? "");
  const [fechaVencimiento, setFechaVencimiento] = useState(sub.fechaVencimiento?.slice(0, 10) ?? "");
  const [fechaEstimadaDesbloqueo, setFechaEstimadaDesbloqueo] = useState(sub.fechaEstimadaDesbloqueo?.slice(0, 10) ?? "");
  const [descripcion, setDescripcion] = useState(sub.notas ?? "");
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);

  useEffect(() => {
    setTitulo(sub.titulo);
    setEstado(sub.estado);
    setPrioridad(sub.prioridad);
    setTipo(sub.tipo ?? "");
    setAsignadoId(sub.asignado?.id?.toString() ?? "");
    setFechaInicio(sub.fechaInicio?.slice(0, 10) ?? "");
    setFechaVencimiento(sub.fechaVencimiento?.slice(0, 10) ?? "");
    setFechaEstimadaDesbloqueo(sub.fechaEstimadaDesbloqueo?.slice(0, 10) ?? "");
    setDescripcion(sub.notas ?? "");
  }, [sub]);

  // Sin autoridad plena sobre la línea de trabajo, solo cuenta (y se guarda)
  // el cambio de estado — igual que mover la tarjeta por drag & drop.
  const hayCambios = puedeEditarCompleto
    ? titulo !== sub.titulo ||
      estado !== sub.estado ||
      prioridad !== sub.prioridad ||
      tipo !== (sub.tipo ?? "") ||
      asignadoId !== (sub.asignado?.id?.toString() ?? "") ||
      fechaInicio !== (sub.fechaInicio?.slice(0, 10) ?? "") ||
      fechaVencimiento !== (sub.fechaVencimiento?.slice(0, 10) ?? "") ||
      fechaEstimadaDesbloqueo !== (sub.fechaEstimadaDesbloqueo?.slice(0, 10) ?? "") ||
      descripcion !== (sub.notas ?? "")
    : estado !== sub.estado || fechaEstimadaDesbloqueo !== (sub.fechaEstimadaDesbloqueo?.slice(0, 10) ?? "");

  async function guardarDetalle() {
    if (!titulo.trim() || !fechaVencimiento) return;
    if (estado === "BLOQUEADO" && !fechaEstimadaDesbloqueo) return;
    setGuardandoDetalle(true);
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify(
          puedeEditarCompleto
            ? {
                titulo: titulo.trim(),
                estado,
                prioridad,
                tipo: tipo || null,
                asignadoId: asignadoId || null,
                fechaInicio: fechaInicio || null,
                fechaVencimiento,
                fechaEstimadaDesbloqueo: estado === "BLOQUEADO" ? fechaEstimadaDesbloqueo : null,
                notas: descripcion || null,
              }
            : {
                estado,
                fechaEstimadaDesbloqueo: estado === "BLOQUEADO" ? fechaEstimadaDesbloqueo : null,
              }
        ),
      });
      showToast("Tarea actualizada", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setGuardandoDetalle(false);
    }
  }

  const puedeEliminarObs = (obs: SubtareaNota) => {
    return obs.autor.id === usuario?.id || esGerencia(usuario?.roles) || esJefatura(usuario?.roles);
  };

  async function agregarObservacion(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaNota.trim()) return;
    setGuardandoNotas(true);
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${sub.id}/observaciones`, {
        method: "POST",
        body: JSON.stringify({ contenido: nuevaNota }),
      });
      setNuevaNota("");
      showToast("Observación agregada", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error al agregar", "error");
    } finally {
      setGuardandoNotas(false);
    }
  }

  async function eliminarObservacion(id: number) {
    if (!confirm("¿Eliminar esta observación?")) return;
    try {
      await apiFetch(`/proyectos-empresa/observaciones/${id}`, { method: "DELETE" });
      showToast("Observación eliminada", "success");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
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
          {/* Detalle editable */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">Detalle</label>

            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Título</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={!puedeEditarCompleto}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoSubtarea)}
                  disabled={!puedeMoverEstado}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {COLUMNAS.map((c) => <option key={c.estado} value={c.estado}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as PrioridadSubtarea)}
                  disabled={!puedeEditarCompleto}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  disabled={!puedeEditarCompleto}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Sin tipo</option>
                  <option value="TÉCNICA">Técnica</option>
                  <option value="ADMINISTRATIVA">Administrativa</option>
                  <option value="TERRENO">Terreno</option>
                  <option value="REUNIÓN">Reunión</option>
                  <option value="COMPRA">Compra</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Asignado a</label>
                <select
                  value={asignadoId}
                  onChange={(e) => setAsignadoId(e.target.value)}
                  disabled={!puedeEditarCompleto}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Sin asignar</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Fecha inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={!puedeEditarCompleto}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Fecha vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  disabled={!puedeEditarCompleto}
                  className={`w-full bg-neutral-50 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed ${!fechaVencimiento ? "border-red-300 text-red-600" : "border-neutral-200 text-neutral-700"}`}
                />
              </div>
            </div>

            {estado === "BLOQUEADO" && (
              <div className="bg-red-50/50 border border-red-200 rounded-lg p-3">
                <label className="text-[10px] font-bold text-red-700 uppercase tracking-wider block mb-1">Fecha estimada de desbloqueo *</label>
                <input
                  type="date"
                  value={fechaEstimadaDesbloqueo}
                  onChange={(e) => setFechaEstimadaDesbloqueo(e.target.value)}
                  disabled={!puedeMoverEstado}
                  className={`w-full bg-white border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed ${!fechaEstimadaDesbloqueo ? "border-red-300 text-red-600" : "border-red-200 text-neutral-700"}`}
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                disabled={!puedeEditarCompleto}
                placeholder="Descripción o notas de la tarea…"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {!puedeEditarCompleto && !puedeMoverEstado && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No tienes permisos para editar esta tarea.
              </p>
            )}

            {(puedeEditarCompleto || puedeMoverEstado) && (
              <div className="flex justify-end">
                <button
                  onClick={guardarDetalle}
                  disabled={guardandoDetalle || !hayCambios || !titulo.trim() || !fechaVencimiento || (estado === "BLOQUEADO" && !fechaEstimadaDesbloqueo)}
                  className="text-xs font-bold bg-neutral-800 hover:bg-black disabled:bg-neutral-300 disabled:text-neutral-500 text-white px-4 py-2 rounded-lg cursor-pointer transition"
                >
                  {guardandoDetalle ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>

          {/* Historial de Observaciones */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-3">Historial de Observaciones</label>
            
            {(!sub.observaciones || sub.observaciones.length === 0) ? (
              <p className="text-xs text-neutral-400 italic bg-neutral-50 border border-neutral-100 p-3 rounded-lg">No hay observaciones registradas aún.</p>
            ) : (
              <div className="space-y-3 mb-5">
                {sub.observaciones.map((obs) => (
                  <div key={obs.id} className="bg-neutral-50 border border-neutral-200 p-3 rounded-lg relative group">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-[11px] font-bold text-neutral-800">{obs.autor.nombre}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(obs.createdAt).toLocaleString("es-CL", { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-xs text-neutral-700 whitespace-pre-wrap">{obs.contenido}</p>
                    {puedeEliminarObs(obs) && (
                      <button
                        onClick={() => eliminarObservacion(obs.id)}
                        className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 shadow-sm cursor-pointer"
                        title="Eliminar observación"
                      >
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={agregarObservacion} className="mt-4">
              <textarea
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                rows={3}
                placeholder="Escribe una nueva observación o hito de esta tarea…"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={guardandoNotas || !nuevaNota.trim()}
                  className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg cursor-pointer transition"
                >
                  {guardandoNotas ? "Añadiendo…" : "Añadir Observación"}
                </button>
              </div>
            </form>
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
                    {puedeMoverEstado && (
                      <button onClick={() => borrarArchivo(a.id)} className="text-neutral-300 hover:text-red-500 cursor-pointer shrink-0">
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {puedeMoverEstado && (
              <>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirArchivo(f); }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-dashed border-neutral-300 text-neutral-600 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 px-3 py-2.5 rounded-lg cursor-pointer transition"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  {subiendo ? "Subiendo…" : "Adjuntar documento"}
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function AgregarSubtarea({ onAdd }: { onAdd: (titulo: string, tipo: string, fecha: string, prioridad: PrioridadSubtarea) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadSubtarea>("MEDIA");

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full mt-1 border border-dashed border-neutral-300 rounded-xl px-2 py-2 text-xs font-bold text-neutral-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition cursor-pointer flex items-center justify-center gap-1"
      >
        <span>+</span> Nueva Tarea
      </button>
    );
  }

  return (
    <div className="bg-white border border-neutral-300 rounded-lg p-3 shadow-md mt-1 relative z-10">
      <div className="space-y-2.5">
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la tarea…"
          className="w-full border-b border-neutral-200 px-1 py-1 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-orange-500"
        />
        <div className="flex gap-2">
          <select 
            value={tipo} 
            onChange={(e) => setTipo(e.target.value)}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded p-1 text-xs text-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">Tipo (opcional)</option>
            <option value="TÉCNICA">Técnica</option>
            <option value="ADMINISTRATIVA">Administrativa</option>
            <option value="TERRENO">Terreno</option>
            <option value="REUNIÓN">Reunión</option>
            <option value="COMPRA">Compra</option>
          </select>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`w-28 bg-neutral-50 border rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 ${!fecha ? "border-red-300 text-red-600" : "border-neutral-200 text-neutral-600"}`}
            title="La fecha de vencimiento es obligatoria"
          />
        </div>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadSubtarea)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded p-1 text-xs text-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>Prioridad: {p.label}</option>)}
        </select>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setAbierto(false)}
            className="flex-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 rounded py-1.5 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            disabled={!titulo.trim() || !fecha.trim()}
            onClick={() => {
              if (titulo.trim() && fecha.trim()) {
                onAdd(titulo, tipo, fecha, prioridad);
                setTitulo("");
                setTipo("");
                setFecha("");
                setPrioridad("MEDIA");
                setAbierto(false);
              }
            }}
            className="flex-1 text-xs font-semibold bg-neutral-800 text-white hover:bg-black disabled:opacity-50 rounded py-1.5 cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── Reasignar responsables / Editar fase ──────────

function ReasignarModal({ obra, usuarios, onClose, onSaved }: { obra: ObraDetalle; usuarios: UsuarioConRol[]; onClose: () => void; onSaved: () => void }) {
  const { usuario } = useAuth();
  const puedeAdministrar = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);

  const [coordinadorId, setCoordinadorId] = useState(obra.coordinador?.id?.toString() ?? "");
  const [faseGlobal, setFaseGlobal] = useState(obra.faseGlobal);
  const [presupuesto, setPresupuesto] = useState(obra.presupuesto ?? "");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
  const coords = usuarios.filter((u) => tieneRol(u.roles, "coordinador") || esGerencia(u.roles) || esJefatura(u.roles));

  async function guardar() {
    setSaving(true);
    try {
      const payload: any = { faseGlobal };
      if (puedeAdministrar) {
        payload.coordinadorId = coordinadorId || null;
        payload.presupuesto = presupuesto !== "" ? Number(presupuesto) : null;
        // Subgerente removido de la UI
      }

      await apiFetch(`/proyectos-empresa/${obra.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      showToast("Proyecto actualizado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={puedeAdministrar ? "Editar responsables / Fase" : "Editar Fase"} onClose={onClose}>
      <div className="space-y-4">
        {puedeAdministrar && (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Coordinador</label>
            <select value={coordinadorId} onChange={(e) => setCoordinadorId(e.target.value)} className={inputClass}>
              <option value="">Sin asignar</option>
              {coords.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        )}
        {puedeAdministrar && (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Presupuesto (CLP)</label>
            <input
              type="number"
              min={0}
              value={presupuesto}
              onChange={(e) => setPresupuesto(e.target.value)}
              placeholder="Sin definir"
              className={inputClass}
            />
          </div>
        )}
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

// ────────── Transferir proyecto (definitiva / temporal / paralela) ──────────

type TipoTransferencia = "DEFINITIVA" | "TEMPORAL" | "PARALELO";

function TransferirProyectoModal({ obra, usuarios, onClose, onSaved }: { obra: ObraDetalle; usuarios: UsuarioConRol[]; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<TipoTransferencia>("DEFINITIVA");
  const [coordinadorId, setCoordinadorId] = useState("");
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatos = usuarios.filter((u) => tieneRol(u.roles, "coordinador") || esGerencia(u.roles) || esJefatura(u.roles));

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
  const chip = (activo: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`;

  async function transferir() {
    setError(null);
    if (!coordinadorId) {
      setError("Selecciona el usuario destinatario.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}/transferencias`, {
        method: "POST",
        body: JSON.stringify({ coordinadorId, tipo, vigenteHasta: vigenteHasta || null }),
      });
      showToast(tipo === "DEFINITIVA" ? "Proyecto transferido" : "Co-coordinador agregado", "success");
      onSaved();
    } catch (e: any) {
      const msg = e.message || "Error al transferir";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function retirarExtra(extraId: number) {
    if (!confirm("¿Retirar esta co-coordinación antes de su vencimiento?")) return;
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}/coordinadores-extra/${extraId}`, { method: "DELETE" });
      showToast("Co-coordinación finalizada", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al retirar", "error");
    }
  }

  return (
    <Modal title="Transferir proyecto" onClose={onClose}>
      <div className="space-y-4">
        {obra.coordinadoresExtra.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-500 block">Co-coordinaciones activas</label>
            {obra.coordinadoresExtra.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                <span className="text-xs text-sky-800">
                  <strong>{c.coordinador.nombre}</strong> — {c.tipo === "TEMPORAL" ? "temporal" : "paralelo"}
                  {c.vigenteHasta ? ` hasta ${new Date(c.vigenteHasta).toLocaleDateString("es-CL")}` : " (sin fecha de término)"}
                </span>
                <button onClick={() => retirarExtra(c.id)} className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer shrink-0">
                  Retirar
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Tipo de transferencia</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTipo("DEFINITIVA")} className={chip(tipo === "DEFINITIVA")}>Definitiva</button>
            <button type="button" onClick={() => setTipo("TEMPORAL")} className={chip(tipo === "TEMPORAL")}>Temporal</button>
            <button type="button" onClick={() => setTipo("PARALELO")} className={chip(tipo === "PARALELO")}>Paralela</button>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">
            {tipo === "DEFINITIVA" && "Reemplaza al coordinador principal del proyecto."}
            {tipo === "TEMPORAL" && "Agrega un coordinador que releva al principal por un período, sin reemplazarlo."}
            {tipo === "PARALELO" && "Agrega un coordinador que comparte la gestión del proyecto junto al principal."}
          </p>
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">{tipo === "DEFINITIVA" ? "Nuevo coordinador" : "Coordinador a agregar"}</label>
          <select value={coordinadorId} onChange={(e) => setCoordinadorId(e.target.value)} className={inputClass}>
            <option value="">Selecciona un usuario…</option>
            {candidatos.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>

        {tipo !== "DEFINITIVA" && (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Vigente hasta (opcional)</label>
            <input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} className={inputClass} />
            <p className="text-[11px] text-neutral-400 mt-1">Sin fecha = queda activo hasta que lo retires manualmente.</p>
          </div>
        )}

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={transferir} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {saving ? "Guardando…" : tipo === "DEFINITIVA" ? "Transferir" : "Agregar co-coordinador"}
          </button>
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
