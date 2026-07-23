import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";
import { TIPOS_OBRA, TIPO_OBRA_LABEL, TIPOS_TRACK } from "./catalogos";
import { esGerencia, esJefatura } from "../../roles";

// ────────── Types ──────────

interface UsuarioLite { id: number; nombre: string; }

interface ObraLite {
  id: number;
  codigoObra: string;
  nombre: string;
  cliente: string;
  tipoObra: string;
  tipoObraDetalle: string | null;
  faseGlobal: string;
  avance: number;
  coordinador: UsuarioLite | null;
  tracks: ObraTrack[];
  riesgoNivel: string;
  riesgoMotivo: string;
  subtareasBloqueadas: number;
  tareasVencidas: number;
}

interface ObraTrack {
  id: number;
  tipo: string;
  nombre: string | null;
  estadoActual: string;
  subtareas?: { estado: string }[];
}

// Etiqueta de tipo de proyecto a mostrar en listado/filtros: si es "Otro" se
// usa la descripción libre que el usuario escribió al crearlo.
function labelTipoObra(o: { tipoObra: string; tipoObraDetalle: string | null }): string {
  if (o.tipoObra === "OTRO") return o.tipoObraDetalle || "Otro";
  return TIPO_OBRA_LABEL[o.tipoObra] ?? o.tipoObra;
}

const FASE_LABEL: Record<string, string> = {
  INICIO: "Inicio",
  GESTION: "Gestión",
  EJECUCION: "Ejecución",
  CERRADO: "Cerrado",
};

const TRACK_LABEL: Record<string, string> = {
  PERMISOS: "Permisos",
  ADQUISICIONES: "Adquisiciones",
  PROGRAMACION: "Programación",
  INSTALACION: "Instalación",
  COMUNICACIONES: "Comunicaciones",
  ENLACES: "Enlaces",
  EMPALMES: "Empalmes",
  HITOS_UOCT: "Hitos UOCT",
  SINTONIA_FINA: "Sintonía fina",
  TRASPASOS_MANTENCION: "Traspasos",
  CANALIZACION: "Canalización",
  OBRAS_CIVILES: "Obras Civiles",
};

// ────────── Component ──────────

export default function ProyectosEmpresaModule() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const puedeAdministrar = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);

  const [obras, setObras] = useState<ObraLite[] | null>(null);
  const [creando, setCreando] = useState(false);

  // Filtros
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [fase, setFase] = useState("");
  const [coord, setCoord] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  function cargar() {
    apiFetch<ObraLite[]>("/proyectos-empresa")
      .then(setObras)
      .catch(() => setObras([]));
  }

  useEffect(cargar, []);

  async function eliminar(obra: ObraLite) {
    if (!confirm(`¿Eliminar el proyecto "${obra.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}`, { method: "DELETE" });
      showToast("Proyecto eliminado", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
    }
  }

  const tiposDisponibles = useMemo(() => [...new Set((obras ?? []).map((o) => o.tipoObra))], [obras]);
  const coordsDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    (obras ?? []).forEach((o) => { if (o.coordinador) map.set(o.coordinador.id, o.coordinador.nombre); });
    return [...map.entries()];
  }, [obras]);

  const filtradas = useMemo(() => {
    return (obras ?? []).filter((o) => {
      if (q && !`${o.nombre} ${o.codigoObra} ${o.cliente}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (tipo && o.tipoObra !== tipo) return false;
      if (fase && o.faseGlobal !== fase) return false;
      if (coord && String(o.coordinador?.id ?? "") !== coord) return false;
      if (soloAlertas && o.riesgoNivel === "OK" && o.tareasVencidas === 0) return false;
      return true;
    });
  }, [obras, q, tipo, fase, coord, soloAlertas]);

  const conAlertas = (obras ?? []).filter((o) => o.riesgoNivel !== "OK" || o.tareasVencidas > 0).length;

  if (!obras) return <CargandoTabla />;

  const selectClass = "bg-white border border-neutral-300 rounded-lg px-2.5 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Proyectos</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Motor operativo de la compañía: listado de proyectos y su avance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {puedeAdministrar && (
            <Link
              to="/proyectos_empresa/alertas"
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition cursor-pointer ${
                conAlertas > 0
                  ? "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                  : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600"
              }`}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Gestión de Alertas
              {conAlertas > 0 && (
                <span className="bg-red-600 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-black">
                  {conAlertas}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg shadow-sm transition cursor-pointer"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* KPIs Rápidos — clickeables: filtran el listado */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <button
          onClick={() => { setFase(""); setSoloAlertas(false); }}
          className={`bg-white border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm cursor-pointer transition hover:shadow ${!fase && !soloAlertas ? "border-neutral-400 ring-1 ring-neutral-300" : "border-neutral-200"}`}
        >
          <span className="text-2xl font-black text-neutral-800">{obras.length}</span>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Total Proyectos</span>
        </button>
        <button
          onClick={() => { setFase(fase === "GESTION" ? "" : "GESTION"); setSoloAlertas(false); }}
          className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm bg-blue-50/30 cursor-pointer transition hover:shadow ${fase === "GESTION" ? "border-blue-400 ring-1 ring-blue-300" : "border-blue-200"}`}
        >
          <span className="text-2xl font-black text-blue-700">{obras.filter(o => o.faseGlobal === "GESTION").length}</span>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1">En Gestión</span>
        </button>
        <button
          onClick={() => { setFase(fase === "EJECUCION" ? "" : "EJECUCION"); setSoloAlertas(false); }}
          className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm bg-orange-50/30 cursor-pointer transition hover:shadow ${fase === "EJECUCION" ? "border-orange-400 ring-1 ring-orange-300" : "border-orange-200"}`}
        >
          <span className="text-2xl font-black text-orange-700">{obras.filter(o => o.faseGlobal === "EJECUCION").length}</span>
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mt-1">En Ejecución</span>
        </button>
        <button
          onClick={() => { setFase(fase === "CERRADO" ? "" : "CERRADO"); setSoloAlertas(false); }}
          className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm bg-emerald-50/30 cursor-pointer transition hover:shadow ${fase === "CERRADO" ? "border-emerald-400 ring-1 ring-emerald-300" : "border-emerald-200"}`}
        >
          <span className="text-2xl font-black text-emerald-700">{obras.filter(o => o.faseGlobal === "CERRADO").length}</span>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Completados</span>
        </button>
        <button
          onClick={() => { setSoloAlertas((v) => !v); setFase(""); }}
          className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm bg-red-50/30 cursor-pointer transition hover:shadow ${soloAlertas ? "border-red-400 ring-1 ring-red-300" : "border-red-200"}`}
        >
          <span className="text-2xl font-black text-red-700">{conAlertas}</span>
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">Con Alertas</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar proyecto, código o cliente…"
            className="w-full bg-white border border-neutral-300 rounded-lg pl-8 pr-3 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
          <option value="">Tipo: todos</option>
          {tiposDisponibles.map((t) => <option key={t} value={t}>{TIPO_OBRA_LABEL[t] ?? t}</option>)}
        </select>
        <select value={fase} onChange={(e) => setFase(e.target.value)} className={selectClass}>
          <option value="">Fase: todas</option>
          {Object.keys(FASE_LABEL).map((f) => <option key={f} value={f}>{FASE_LABEL[f]}</option>)}
        </select>
        <select value={coord} onChange={(e) => setCoord(e.target.value)} className={selectClass}>
          <option value="">Coordinador: todos</option>
          {coordsDisponibles.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <button
          onClick={() => setSoloAlertas((v) => !v)}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg border cursor-pointer transition ${soloAlertas ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50"}`}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Solo con alertas
        </button>
        {(q || tipo || fase || coord || soloAlertas) && (
          <button onClick={() => { setQ(""); setTipo(""); setFase(""); setCoord(""); setSoloAlertas(false); }} className="text-xs font-semibold text-neutral-500 hover:text-orange-600 px-2 py-2 cursor-pointer">
            Limpiar
          </button>
        )}
        <span className="text-[11px] text-neutral-400 ml-auto">{filtradas.length} de {obras.length}</span>
      </div>

      {/* Tabla de proyectos */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-1/5">Proyecto</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Coordinador</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Alertas</th>
              <th className="px-4 py-3">Líneas de trabajo</th>
              <th className="px-4 py-3">Avance</th>
              {puedeAdministrar && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={puedeAdministrar ? 9 : 8} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {obras.length === 0 ? "No hay proyectos activos en el sistema." : "Ningún proyecto coincide con los filtros."}
                </td>
              </tr>
            ) : (
              filtradas.map((obra) => {
                // Tracks con tareas, los más rezagados primero (los que piden atención).
                const tracksConTareas = obra.tracks
                  .map((t) => {
                    const total = t.subtareas?.length || 0;
                    const completadas = t.subtareas?.filter((s) => s.estado === "HECHO").length || 0;
                    return { ...t, avanceTrack: total > 0 ? Math.round((completadas / total) * 100) : 0, total };
                  })
                  .filter((t) => t.total > 0)
                  .sort((a, b) => a.avanceTrack - b.avanceTrack);
                const tracksVisibles = tracksConTareas.slice(0, 4);
                const tieneAlerta = obra.riesgoNivel !== "OK" || obra.tareasVencidas > 0;

                return (
                <tr
                  key={obra.id}
                  onClick={() => navigate(`/proyectos_empresa/detalle/${obra.id}`)}
                  className="hover:bg-neutral-50/50 transition cursor-pointer"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        obra.riesgoNivel === "BLOQUEADO" ? "bg-red-500" :
                        obra.riesgoNivel === "RIESGO" || obra.tareasVencidas > 0 ? "bg-amber-500" :
                        "bg-emerald-500"
                      }`} title={tieneAlerta ? obra.riesgoMotivo : "Sin alertas"} />
                      <span className="font-semibold text-sm text-orange-600 group-hover:underline">{obra.nombre}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5 ml-4">{obra.codigoObra}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{obra.cliente}</td>
                  <td className="px-4 py-4 text-sm text-neutral-600 max-w-[180px] truncate" title={labelTipoObra(obra)}>{labelTipoObra(obra)}</td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{obra.coordinador?.nombre ?? <span className="italic text-neutral-400">sin asignar</span>}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold tracking-wide border uppercase ${
                      obra.faseGlobal === "GESTION" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      obra.faseGlobal === "EJECUCION" ? "bg-orange-50 text-orange-700 border-orange-200" :
                      obra.faseGlobal === "CERRADO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-neutral-100 text-neutral-700 border-neutral-200"
                    }`}>
                      {FASE_LABEL[obra.faseGlobal] ?? obra.faseGlobal}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {!tieneAlerta ? (
                      <span className="text-[11px] text-neutral-300">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5 items-start">
                        {obra.riesgoNivel !== "OK" && (
                          <span
                            title={obra.riesgoMotivo}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${
                              obra.riesgoNivel === "BLOQUEADO" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            {obra.riesgoNivel === "BLOQUEADO" ? `Bloqueado${obra.subtareasBloqueadas > 0 ? ` (${obra.subtareasBloqueadas})` : ""}` : "Riesgo"}
                          </span>
                        )}
                        {obra.tareasVencidas > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-red-600 border-red-200">
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {obra.tareasVencidas} vencida{obra.tareasVencidas === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[200px]">
                    {tracksVisibles.length === 0 ? (
                      <span className="text-[11px] italic text-neutral-400">Sin tareas creadas</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {tracksVisibles.map((track) => (
                          <div key={track.id} className="flex items-center gap-2">
                            <span className="w-20 text-[9px] font-bold tracking-wider text-neutral-500 uppercase truncate" title={track.nombre ?? TRACK_LABEL[track.tipo] ?? track.tipo}>
                              {track.nombre ?? TRACK_LABEL[track.tipo] ?? track.tipo}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex">
                              <div
                                className={`h-full ${track.avanceTrack === 100 ? "bg-emerald-500" : track.estadoActual === "BLOQUEADO" ? "bg-red-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.max(track.avanceTrack, track.estadoActual === "BLOQUEADO" ? 6 : 0)}%` }}
                              />
                            </div>
                            <span className="w-6 text-[9px] text-right font-medium text-neutral-500">{track.avanceTrack}%</span>
                          </div>
                        ))}
                        {tracksConTareas.length > tracksVisibles.length && (
                          <span className="text-[9px] text-neutral-400 font-medium">+{tracksConTareas.length - tracksVisibles.length} líneas más</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[110px]">
                    <div className="h-2.5 w-full rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${obra.avance}%` }} />
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1">{obra.avance}%</div>
                  </td>
                  {puedeAdministrar && (
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminar(obra); }}
                        title="Eliminar proyecto"
                        className="text-neutral-300 hover:text-red-500 transition cursor-pointer"
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </td>
                  )}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {creando && <NuevaObraModal onClose={() => setCreando(false)} onCreated={() => { setCreando(false); cargar(); }} />}
    </div>
  );
}

// ────────── Modal Nueva Obra ──────────

import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";

function NuevaObraModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [codigoObra, setCodigoObra] = useState("");
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [tipoObra, setTipoObra] = useState("SEMAFORIZACION_NUEVA");
  const [tipoObraDetalle, setTipoObraDetalle] = useState("");
  const [tracksSeleccionados, setTracksSeleccionados] = useState<Set<string>>(
    new Set(["PERMISOS", "ADQUISICIONES", "PROGRAMACION", "INSTALACION"])
  );
  const [tracksPersonalizados, setTracksPersonalizados] = useState<string[]>([]);
  const [nuevoPersonalizado, setNuevoPersonalizado] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

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

  async function guardar() {
    if (!codigoObra.trim() || !nombre.trim() || !cliente.trim()) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }
    if (tipoObra === "OTRO" && !tipoObraDetalle.trim()) {
      showToast("Describe el tipo de proyecto cuando eliges \"Otro\"", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/proyectos-empresa", {
        method: "POST",
        body: JSON.stringify({
          codigoObra: codigoObra.trim(),
          nombre: nombre.trim(),
          cliente: cliente.trim(),
          tipoObra,
          tipoObraDetalle: tipoObra === "OTRO" ? tipoObraDetalle.trim() : null,
          tracks: [
            ...[...tracksSeleccionados].map((tipo) => ({ tipo, nombre: null })),
            ...tracksPersonalizados.map((nombre) => ({ tipo: "OTRO", nombre })),
          ],
        })
      });
      showToast("Proyecto creado", "success");
      onCreated();
    } catch (e: any) {
      showToast(e.message || "Error al crear", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Crear Nuevo Proyecto" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Código (ej: OBR-2024-001) *</label>
          <input value={codigoObra} onChange={(e) => setCodigoObra(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Semáforo Av. Kennedy" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Cliente *</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Tipo de proyecto</label>
          <select value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} className={inputClass}>
            {TIPOS_OBRA.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </div>
        {tipoObra === "OTRO" && (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Descripción del tipo de proyecto *</label>
            <input
              value={tipoObraDetalle}
              onChange={(e) => setTipoObraDetalle(e.target.value)}
              className={inputClass}
              placeholder="Ej: Retiro de infraestructura obsoleta"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">
            Líneas de trabajo <span className="text-neutral-400 font-normal">(haz clic para incluirlas)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_TRACK.filter((t) => t.code !== "OTRO").map((t) => {
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

          {tracksSeleccionados.size === 0 && tracksPersonalizados.length === 0 && (
            <p className="text-xs text-neutral-400 italic mt-2">Sin líneas de trabajo — puedes agregarlas después dentro del proyecto.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {saving ? "Creando..." : "Crear Proyecto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
