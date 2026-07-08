import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { ReportePDF, type TerminoGlosarioPDF } from './ReportePDF';
import { PaginaPDF } from './PaginaPDF';
import { ConstructorStack } from './ConstructorStack';
import Pizarra from './Pizarra';
import { TextoGlosario } from '../../components/TextoGlosario';
import { IncidenciaFormModal } from "../iot/Troubleshooting";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import {
  COLUMNAS_KANBAN,
  ESTADO_PROYECTO_COLOR,
  ESTADO_PROYECTO_LABEL,
  ESTADO_TAREA_LABEL,
  type EstadoProyecto,
  type EstadoTarea,
  type Proyecto,
  type ProyectoPagina,
  type ProyectoTarea,
  type UsuarioLite,
  type Tecnologia,
} from "./types";

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL");
}

export default function ProyectoDetalle() {
  const { proyectoId } = useParams();
  const navigate = useNavigate();
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tareas" | "documentacion" | "biblioteca" | "stack" | "pizarra" | "troubleshooting">("tareas");
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  function cargar() {
    apiFetch<Proyecto>(`/proyectos/${proyectoId}`)
      .then(setProyecto)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, [proyectoId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!proyecto) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <Link to="/iot/proyectos" className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-orange-600 transition-colors">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Volver a Proyectos
      </Link>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-neutral-800 tracking-tight">{proyecto.nombre}</h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${ESTADO_PROYECTO_COLOR[proyecto.estado]}`}>
                {ESTADO_PROYECTO_LABEL[proyecto.estado]}
              </span>
            </div>
            {proyecto.descripcion && <TextoGlosario texto={proyecto.descripcion} className="text-sm text-neutral-500 mt-2 max-w-3xl leading-relaxed" />}

            <div className="flex items-center gap-6 flex-wrap mt-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-100">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Responsable: <span className="font-semibold text-neutral-700">{proyecto.responsable?.nombre ?? "Sin asignar"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Inicio: {formatFecha(proyecto.fechaInicio)}
              </span>
              <span className="flex items-center gap-1.5">
                Fin: {formatFecha(proyecto.fechaFin)}
              </span>
            </div>
          </div>
          {puedeEscribir && (
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => setGenerandoInforme(true)} 
                className="flex items-center gap-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-950 text-white px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Generar Reporte PDF
              </button>
              <button onClick={() => setEditando(true)} className="text-xs font-bold bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg shadow-sm transition">
                Editar proyecto
              </button>
              <button onClick={() => setEliminando(true)} className="text-xs font-bold bg-white hover:bg-red-50 border border-neutral-200 hover:border-red-200 text-red-600 px-3 py-1.5 rounded-lg shadow-sm transition">
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Tabs estilo "Pill" moderno */}
        <div className="flex items-center gap-1 mt-6 bg-neutral-100/80 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("tareas")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "tareas" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Tablero Kanban
          </button>
          <button
            onClick={() => setTab("documentacion")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "documentacion" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Documentación técnica
          </button>
          <button
            onClick={() => setTab("biblioteca")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "biblioteca" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Biblioteca técnica
          </button>
          <button
            onClick={() => setTab("stack")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "stack" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Arquitectura del Stack
          </button>
          <button
            onClick={() => setTab("pizarra")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "pizarra" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Pizarra
          </button>
          <button
            onClick={() => setTab("troubleshooting")}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${tab === "troubleshooting" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"}`}
          >
            Fallas (Troubleshooting)
          </button>
        </div>
      </div>

      {tab === "tareas" ? (
        <KanbanBoard proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
      ) : tab === "documentacion" ? (
        <Documentacion proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
      ) : tab === "biblioteca" ? (
        <BibliotecaTecnica proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
      ) : tab === "pizarra" ? (
        <Pizarra
          endpoint={`/proyectos/${proyecto.id}/pizarra`}
          nombreArchivo={`pizarra-${proyecto.nombre.replace(/\s+/g, "_")}`}
          puedeEscribir={puedeEscribir}
        />
      ) : tab === "troubleshooting" ? (
        <ProyectoTroubleshooting proyectoId={proyecto.id} puedeEscribir={puedeEscribir} />
      ) : (
        <ConstructorStack proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
      )}

      {editando && (
        <EditarProyectoModal proyecto={proyecto} onClose={() => setEditando(false)} onSaved={() => { setEditando(false); cargar(); }} />
      )}

      {eliminando && (
        <EliminarProyectoModal
          proyecto={proyecto}
          onClose={() => setEliminando(false)}
          onDeleted={() => navigate("/iot/proyectos")}
        />
      )}

      {generandoInforme && (
        <GenerarInformeModal
          proyecto={proyecto}
          onClose={() => setGenerandoInforme(false)}
        />
      )}
    </div>
  );
}

function EditarProyectoModal({ proyecto, onClose, onSaved }: { proyecto: Proyecto; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [descripcion, setDescripcion] = useState(proyecto.descripcion ?? "");
  const [estado, setEstado] = useState<EstadoProyecto>(proyecto.estado);
  const [fechaInicio, setFechaInicio] = useState(proyecto.fechaInicio?.slice(0, 10) ?? "");
  const [fechaFin, setFechaFin] = useState(proyecto.fechaFin?.slice(0, 10) ?? "");
  const [responsableId, setResponsableId] = useState<number | "">(proyecto.responsableId ?? "");
  const [usuarios, setUsuarios] = useState<UsuarioLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsuarioLite[]>("/proyectos/usuarios").then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/proyectos/${proyecto.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          estado,
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          responsableId: responsableId || null,
        }),
      });
      showToast("Proyecto actualizado.", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Editar proyecto" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoProyecto)} className={inputClass}>
              {Object.entries(ESTADO_PROYECTO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Responsable</label>
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Fecha fin</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EliminarProyectoModal({ proyecto, onClose, onDeleted }: { proyecto: Proyecto; onClose: () => void; onDeleted: () => void }) {
  const [confirmado, setConfirmado] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function eliminar() {
    setDeleting(true);
    try {
      await apiFetch(`/proyectos/${proyecto.id}`, { method: "DELETE" });
      showToast(`${proyecto.nombre} eliminado.`, "success");
      onDeleted();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (!confirmado) {
    return (
      <Modal title="Eliminar proyecto" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            ¿Eliminar <span className="font-semibold">{proyecto.nombre}</span>?
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Se eliminarán también todas sus tareas y páginas de documentación.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
              Cancelar
            </button>
            <button onClick={() => setConfirmado(true)} className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg">
              Continuar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Confirmar eliminación" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          Confirma por segunda vez: esta acción <span className="font-semibold">no se puede deshacer</span>.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setConfirmado(false)} disabled={deleting} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Volver
          </button>
          <button onClick={eliminar} disabled={deleting} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {deleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Kanban ─────────────────────────

function KanbanBoard({ proyecto, puedeEscribir, onChange }: { proyecto: Proyecto; puedeEscribir: boolean; onChange: () => void }) {
  const tareas = proyecto.tareas as ProyectoTarea[] | undefined;
  const [tareaModal, setTareaModal] = useState<{ modo: "nueva"; estado: EstadoTarea } | { modo: "editar"; tarea: ProyectoTarea } | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [colDestacada, setColDestacada] = useState<EstadoTarea | null>(null);

  async function moverA(tareaId: number, estado: EstadoTarea) {
    try {
      await apiFetch(`/proyectos/tareas/${tareaId}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo mover la tarea", "error");
    }
  }

  if (!tareas) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNAS_KANBAN.map((col) => {
        const tareasCol = tareas.filter((t) => t.estado === col);
        return (
          <div
            key={col}
            onDragOver={(e) => {
              if (puedeEscribir) {
                e.preventDefault();
                setColDestacada(col);
              }
            }}
            onDragLeave={() => setColDestacada((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setColDestacada(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) moverA(id, col);
            }}
            className={`bg-neutral-50/70 border rounded-2xl p-3 min-h-[300px] flex flex-col transition-colors ${colDestacada === col ? "border-orange-400 bg-orange-50/50" : "border-neutral-200"}`}
          >
            <div className="flex items-center justify-between mb-3 px-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{ESTADO_TAREA_LABEL[col]}</p>
              <span className="text-xs font-semibold bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">{tareasCol.length}</span>
            </div>

            <div className="space-y-3 flex-1">
              {tareasCol.map((t) => (
                <div
                  key={t.id}
                  draggable={puedeEscribir}
                  onDragStart={(e) => {
                    setArrastrando(t.id);
                    e.dataTransfer.setData("text/plain", String(t.id));
                  }}
                  onDragEnd={() => setArrastrando(null)}
                  onClick={() => puedeEscribir && setTareaModal({ modo: "editar", tarea: t })}
                  className={`bg-white border border-neutral-200 rounded-xl p-4 shadow-sm group transition-all ${puedeEscribir ? "cursor-grab active:cursor-grabbing hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5" : ""} ${arrastrando === t.id ? "opacity-30 border-dashed" : ""}`}
                >
                  <p className="text-sm font-bold text-neutral-800 group-hover:text-orange-600 transition-colors leading-tight">{t.titulo}</p>
                  {t.descripcion && <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2">{t.descripcion}</p>}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-50 text-[10px] text-neutral-400 font-medium">
                    <span className="flex items-center gap-1 bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100">
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      {t.asignado?.nombre ?? "N/A"}
                    </span>
                    {t.fechaLimite && (
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {formatFecha(t.fechaLimite)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {puedeEscribir && (
              <button
                onClick={() => setTareaModal({ modo: "nueva", estado: col })}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-orange-600 hover:bg-orange-50 mt-3 py-2 rounded-xl transition-colors border border-transparent hover:border-orange-200/50"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Añadir tarea
              </button>
            )}
          </div>
        );
      })}

      {tareaModal && (
        <TareaModal
          proyectoId={proyecto.id}
          modo={tareaModal}
          onClose={() => setTareaModal(null)}
          onDone={() => {
            setTareaModal(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function TareaModal({
  proyectoId,
  modo,
  onClose,
  onDone,
}: {
  proyectoId: number;
  modo: { modo: "nueva"; estado: EstadoTarea } | { modo: "editar"; tarea: ProyectoTarea };
  onClose: () => void;
  onDone: () => void;
}) {
  const tareaExistente = modo.modo === "editar" ? modo.tarea : null;
  const [titulo, setTitulo] = useState(tareaExistente?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(tareaExistente?.descripcion ?? "");
  const [estado, setEstado] = useState<EstadoTarea>(modo.modo === "editar" ? modo.tarea.estado : modo.estado);
  const [asignadoId, setAsignadoId] = useState<number | "">(tareaExistente?.asignadoId ?? "");
  const [fechaLimite, setFechaLimite] = useState(tareaExistente?.fechaLimite?.slice(0, 10) ?? "");
  const [usuarios, setUsuarios] = useState<UsuarioLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsuarioLite[]>("/proyectos/usuarios").then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function guardar() {
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        estado,
        asignadoId: asignadoId || null,
        fechaLimite: fechaLimite || null,
      });
      if (tareaExistente) {
        await apiFetch(`/proyectos/tareas/${tareaExistente.id}`, { method: "PATCH", body });
      } else {
        await apiFetch(`/proyectos/${proyectoId}/tareas`, { method: "POST", body });
      }
      showToast("Tarea guardada.", "success");
      onDone();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!tareaExistente) return;
    setSaving(true);
    try {
      await apiFetch(`/proyectos/tareas/${tareaExistente.id}`, { method: "DELETE" });
      showToast("Tarea eliminada.", "success");
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={tareaExistente ? "Editar tarea" : "Nueva tarea"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Columna</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoTarea)} className={inputClass}>
              {COLUMNAS_KANBAN.map((c) => (
                <option key={c} value={c}>
                  {ESTADO_TAREA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Asignado a</label>
            <select value={asignadoId} onChange={(e) => setAsignadoId(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Fecha límite</label>
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={inputClass} />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        {confirmandoBorrado ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs text-red-700 font-semibold">¿Eliminar esta tarea? No se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmandoBorrado(false)} className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-800">
                Cancelar
              </button>
              <button onClick={eliminar} disabled={saving} className="text-[11px] font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-md">
                Eliminar definitivamente
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2 pt-2">
            {tareaExistente ? (
              <button onClick={() => setConfirmandoBorrado(true)} className="text-xs font-semibold text-red-600 hover:text-red-700">
                Eliminar tarea
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ───────────────────────── Documentación ─────────────────────────

function Documentacion({ proyecto, puedeEscribir, onChange }: { proyecto: Proyecto; puedeEscribir: boolean; onChange: () => void }) {
  const paginas = proyecto.paginas ?? [];
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(paginas[0]?.id ?? null);
  const [creandoPagina, setCreandoPagina] = useState(false);

  useEffect(() => {
    if (paginas.length > 0 && !paginas.some((p) => p.id === seleccionadaId)) {
      setSeleccionadaId(paginas[0].id);
    }
    if (paginas.length === 0) setSeleccionadaId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginas.map((p) => p.id).join(",")]);

  const seleccionada = paginas.find((p) => p.id === seleccionadaId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Sidebar Documentación */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 lg:col-span-1 shadow-sm">
        <div className="flex items-center justify-between px-1 mb-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Páginas</p>
        </div>
        <div className="space-y-1">
          {paginas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSeleccionadaId(p.id)}
              className={`w-full text-left flex items-center gap-2 text-sm px-3 py-2 rounded-xl truncate transition-all ${
                seleccionadaId === p.id 
                  ? "bg-white border border-neutral-200 text-orange-600 font-bold shadow-sm" 
                  : "text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-800 border border-transparent"
              }`}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={seleccionadaId === p.id ? "text-orange-500" : "text-neutral-400"}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              {p.titulo}
            </button>
          ))}
          {paginas.length === 0 && <p className="text-xs text-neutral-400 px-3 py-2 italic">Sin páginas aún.</p>}
        </div>
        {puedeEscribir && (
          <button onClick={() => setCreandoPagina(true)} className="w-full flex items-center gap-2 text-xs font-bold text-orange-600 hover:bg-orange-50 mt-4 px-3 py-2 rounded-xl transition-colors border border-dashed border-orange-200 hover:border-orange-400">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva página
          </button>
        )}
      </div>

      {/* Editor Área */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 lg:col-span-3 min-h-[400px] shadow-sm">
        {seleccionada ? (
          <PaginaEditor key={seleccionada.id} pagina={seleccionada} proyectoNombre={proyecto.nombre} puedeEscribir={puedeEscribir} onChange={onChange} />
        ) : (
          <p className="text-sm text-neutral-400">Selecciona o crea una página de documentación.</p>
        )}
      </div>

      {creandoPagina && (
        <NuevaPaginaModal
          proyectoId={proyecto.id}
          onClose={() => setCreandoPagina(false)}
          onCreated={(pagina) => {
            setCreandoPagina(false);
            setSeleccionadaId(pagina.id);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function PaginaEditor({ pagina, proyectoNombre, puedeEscribir, onChange }: { pagina: ProyectoPagina; proyectoNombre: string; puedeEscribir: boolean; onChange: () => void }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(pagina.titulo);
  const [saving, setSaving] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);

  // Genera y descarga un PDF real (sin diálogo de impresión) con el contenido
  // de la página y las referencias del glosario que aparecen en ella.
  async function handleExportarPDF() {
    setExportandoPDF(true);
    try {
      const glosario = await apiFetch<TerminoGlosarioPDF[]>("/proyectos/glosario").catch(() => [] as TerminoGlosarioPDF[]);
      const html = editor?.getHTML() ?? pagina.contenido;
      const textoPlano = `${pagina.titulo} ${html.replace(/<[^>]+>/g, " ")}`.toLowerCase();
      const usados = glosario.filter((t) => textoPlano.includes(t.termino.toLowerCase()));

      const blob = await pdf(
        <PaginaPDF titulo={pagina.titulo} proyectoNombre={proyectoNombre} html={html} glosario={usados} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proyectoNombre.replace(/\s+/g, "_")}_${pagina.titulo.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast("No se pudo generar el PDF", "error");
    } finally {
      setExportandoPDF(false);
    }
  }

  // Configuración del editor Pro (Tiptap)
  const editor = useEditor({
    extensions: [StarterKit],
    content: pagina.contenido,
    editable: editando,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] text-neutral-700 print:text-black',
      },
    },
  });

  // Plantillas rápidas para desarrollo
  const insertarPlantilla = (tipo: 'api' | 'iot' | 'script') => {
    if (!editor) return;
    
    let html = '';
    if (tipo === 'api') {
      html = `
        <h3>Endpoint: <code>/api/v1/recurso</code></h3>
        <p><strong>Método:</strong> GET/POST</p>
        <p><strong>Payload esperado (JSON):</strong></p>
        <pre><code class="language-json">{
  "parametro": "valor"
}</code></pre>
      `;
    } else if (tipo === 'iot') {
      html = `
        <h3>Configuración de Gateway</h3>
        <ul>
          <li><strong>Modelo:</strong> </li>
          <li><strong>Protocolo:</strong> MQTT / TCP</li>
          <li><strong>Broker URL:</strong> </li>
        </ul>
        <p><strong>Notas de telemetría:</strong></p>
        <blockquote>Especificar aquí los parámetros de conexión and timeouts.</blockquote>
      `;
    } else if (tipo === 'script') {
      html = `
        <h3>Snippet de Lógica</h3>
        <pre><code class="language-python"># Función principal de procesamiento
def procesar_datos(payload):
    pass</code></pre>
      `;
    }
    
    editor.chain().focus().insertContent(html).run();
  };

  async function guardar() {
    if (!editor) return;
    setSaving(true);
    try {
      await apiFetch(`/proyectos/paginas/${pagina.id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          titulo: titulo.trim() || pagina.titulo, 
          contenido: editor.getHTML() // Guardamos el HTML enriquecido, no Markdown
        }),
      });
      showToast("Página guardada.", "success");
      setEditando(false);
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    setSaving(true);
    try {
      await apiFetch(`/proyectos/paginas/${pagina.id}`, { method: "DELETE" });
      showToast("Página eliminada.", "success");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    } finally {
      setSaving(false);
    }
  }

  // Sincronizar el contenido si cambia de página sin desmontar, y actualizar editability
  useEffect(() => {
    if (editor) {
      if (!editando) {
        editor.commands.setContent(pagina.contenido);
        setTitulo(pagina.titulo);
      }
      editor.setEditable(editando);
    }
  }, [pagina, editor, editando]);

  if (confirmandoBorrado) {
    return (
      <div className="space-y-4 no-print">
        <p className="text-sm text-neutral-700">
          ¿Eliminar la página <span className="font-semibold">{pagina.titulo}</span>? No se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmandoBorrado(false)} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">Cancelar</button>
          <button onClick={eliminar} disabled={saving} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">{saving ? "Eliminando…" : "Eliminar definitivamente"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* HEADER DE BOTONES (Se oculta al imprimir gracias a la clase 'no-print') */}
      <div className="flex items-start justify-between gap-3 mb-6 no-print">
        {editando ? (
          <input 
            value={titulo} 
            onChange={(e) => setTitulo(e.target.value)} 
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xl font-black text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500" 
          />
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-neutral-800 tracking-tight">{pagina.titulo}</h2>
            {/* Descarga directa como PDF (sin diálogo de impresión) */}
            <button
              onClick={handleExportarPDF}
              disabled={exportandoPDF}
              className="flex items-center gap-1.5 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 px-3 py-1.5 rounded-lg transition-colors border border-neutral-200 cursor-pointer"
              title="Descargar página como PDF (incluye referencias del glosario)"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exportandoPDF ? "Generando…" : "PDF"}
            </button>
          </div>
        )}
        
        {puedeEscribir && (
          <div className="flex items-center gap-2 shrink-0">
            {editando ? (
              <>
                <button onClick={() => { setEditando(false); editor?.commands.setContent(pagina.contenido); }} className="text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg transition">Cancelar</button>
                <button onClick={guardar} disabled={saving} className="text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg shadow-sm transition">{saving ? "Guardando…" : "Guardar página"}</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditando(true)} className="text-xs font-bold bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg shadow-sm transition">Editar página</button>
                <button onClick={() => setConfirmandoBorrado(true)} className="text-xs font-bold bg-white hover:bg-red-50 border border-neutral-200 hover:border-red-200 text-red-600 px-3 py-1.5 rounded-lg shadow-sm transition">Eliminar</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Barra de herramientas Pro (Solo visible al editar) - Se oculta al imprimir */}
      {editando && editor && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-neutral-100 flex-wrap no-print">
          <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg p-1">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-md transition ${editor.isActive('bold') ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
            </button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-md transition ${editor.isActive('italic') ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
            </button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-1.5 rounded-md font-black text-sm transition ${editor.isActive('heading', { level: 3 }) ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}>
              H
            </button>
          </div>

          <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg p-1">
             <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded-md transition ${editor.isActive('codeBlock') ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-800'}`} title="Bloque de código">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-md transition ${editor.isActive('bulletList') ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>

          <div className="h-6 w-px bg-neutral-200 mx-1"></div>

          {/* Botones de Inserción Rápida */}
          <div className="flex gap-2">
            <button onClick={() => insertarPlantilla('iot')} className="flex items-center gap-1.5 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-md border border-blue-200 transition">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
              + Gateway/Hardware
            </button>
            <button onClick={() => insertarPlantilla('api')} className="flex items-center gap-1.5 text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1.5 rounded-md border border-green-200 transition">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              + Docs API/JSON
            </button>
            <button onClick={() => insertarPlantilla('script')} className="flex items-center gap-1.5 text-[11px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 px-2.5 py-1.5 rounded-md border border-neutral-300 transition">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              + Lógica/Script
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DEL DOCUMENTO */}
      <div
        className={`flex-1 ${editando ? 'bg-neutral-50/50 rounded-xl p-4 border-2 border-orange-100 focus-within:border-orange-400 transition-colors' : ''}`}
      >
        {!pagina.contenido && !editando ? (
          <p className="text-sm text-neutral-400 italic no-print">Esta página de documentación está vacía. Haz clic en "Editar página" para comenzar.</p>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}

function NuevaPaginaModal({ proyectoId, onClose, onCreated }: { proyectoId: number; onClose: () => void; onCreated: (p: ProyectoPagina) => void }) {
  const [titulo, setTitulo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const pagina = await apiFetch<ProyectoPagina>(`/proyectos/${proyectoId}/paginas`, {
        method: "POST",
        body: JSON.stringify({ titulo: titulo.trim() }),
      });
      showToast(`Página "${pagina.titulo}" creada.`, "success");
      onCreated(pagina);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo crear la página";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nueva página" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} placeholder="Especificación técnica" autoFocus />
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Creando…" : "Crear página"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GenerarInformeModal({ proyecto, onClose }: { proyecto: Proyecto; onClose: () => void }) {
  const { usuario } = useAuth(); // Para sacar tu nombre
  const [resumen, setResumen] = useState("");
  const [glosario, setGlosario] = useState<TerminoGlosarioPDF[] | null>(null);

  useEffect(() => {
    apiFetch<TerminoGlosarioPDF[]>("/proyectos/glosario")
      .then(setGlosario)
      .catch(() => setGlosario([]));
  }, []);

  // Corpus de texto del proyecto: descripción, resumen escrito, páginas de
  // documentación (sin HTML), componentes del stack y tecnologías enlazadas.
  const corpus = [
    proyecto.nombre,
    proyecto.descripcion ?? "",
    resumen,
    ...(proyecto.paginas ?? []).map((p) => `${p.titulo} ${p.contenido.replace(/<[^>]+>/g, " ")}`),
    ...(proyecto.componentesStack ?? []).map((c) => `${c.nombre} ${c.detalles ?? ""}`),
    ...(proyecto.tecnologias ?? []).map((t) => `${t.nombre} ${t.descripcion ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();

  // Solo se referencian los términos del glosario que efectivamente aparecen en el proyecto.
  const terminosUsados = (glosario ?? []).filter((t) => corpus.includes(t.termino.toLowerCase()));

  return (
    <Modal title="Generar Informe Ejecutivo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-neutral-500 block mb-1.5 uppercase tracking-wider">
            Resumen Ejecutivo (Asistido por IA)
          </label>
          <p className="text-[11px] text-neutral-400 mb-2">
            Pega aquí la traducción verbal de los avances. Este texto aparecerá en la primera plana del PDF para gerencia.
          </p>
          <textarea
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            rows={5}
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Ej: Durante esta semana se integraron con éxito los controladores..."
          />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Referencias del glosario</p>
          {glosario === null ? (
            <p className="text-[11px] text-neutral-400">Analizando términos técnicos…</p>
          ) : terminosUsados.length === 0 ? (
            <p className="text-[11px] text-neutral-400">
              Ningún término del glosario aparece en el contenido del proyecto. El PDF no incluirá sección de referencias.
            </p>
          ) : (
            <p className="text-[11px] text-neutral-600">
              El PDF incluirá como referencias:{" "}
              <span className="font-semibold">{terminosUsados.map((t) => t.termino).join(", ")}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-lg">
            Cancelar
          </button>

          {/* El botón mágico que renderiza y descarga el PDF */}
          <PDFDownloadLink
            document={<ReportePDF proyecto={proyecto} resumenIA={resumen} autor={usuario?.nombre ?? "Desarrollo"} glosario={terminosUsados} />}
            fileName={`Reporte_${proyecto.nombre.replace(/\s+/g, '_')}.pdf`}
            className="flex items-center gap-1 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {({ loading }) => (
              loading ? "Preparando documento..." : "Descargar PDF Corporativo"
            )}
          </PDFDownloadLink>
        </div>
      </div>
    </Modal>
  );
}

function BibliotecaTecnica({ proyecto, puedeEscribir, onChange }: { proyecto: Proyecto; puedeEscribir: boolean; onChange: () => void }) {
  const tecnologiasVinculadas = proyecto.tecnologias ?? [];
  const [enlazando, setEnlazando] = useState(false);

  async function desenlazarTecnologia(tecnologiaId: number, nombre: string) {
    if (!confirm(`¿Desenlazar la tecnología "${nombre}" de este proyecto? No se eliminarán sus archivos globales.`)) return;
    try {
      await apiFetch(`/proyectos/${proyecto.id}/tecnologias/${tecnologiaId}`, { method: "DELETE" });
      showToast("Tecnología desenlazada.", "success");
      onChange();
    } catch (e: any) {
      showToast(e.message || "No se pudo desenlazar la tecnología.", "error");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm min-h-[400px]">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-neutral-800">Biblioteca Técnica del Proyecto</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Equipos, sistemas de comunicación y software homologados desde la zona de I+D para esta implementación.
          </p>
        </div>
        {puedeEscribir && (
          <button 
            onClick={() => setEnlazando(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Enlazar Tecnología Existente
          </button>
        )}
      </div>

      {/* Contenido principal */}
      {tecnologiasVinculadas.length === 0 ? (
        <div className="border-2 border-dashed border-neutral-200 rounded-xl p-12 text-center max-w-xl mx-auto flex flex-col items-center">
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400 mb-3" viewBox="0 0 24 24"><path d="M2 12h4l2-9 5 18 3-10h6"/></svg>
          <p className="text-sm font-bold text-neutral-700">No hay tecnologías enlazadas a este proyecto</p>
          <p className="text-xs text-neutral-400 mt-1">
            Vincula los dispositivos de hardware, pasarelas o librerías de software que estás desplegando en este hito operativo.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {tecnologiasVinculadas.map((tech) => (
            <div key={tech.id} className="group border border-neutral-200 rounded-xl p-5 bg-neutral-50/30 hover:border-neutral-300 hover:shadow-sm transition-all duration-300 relative">
              {puedeEscribir && (
                <button
                  onClick={() => desenlazarTecnologia(tech.id, tech.nombre)}
                  className="absolute top-5 right-5 p-1 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Desenlazar de este proyecto"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}

              {/* Información de la Tecnología */}
              <div className="flex items-start justify-between border-b border-neutral-100 pb-3 mb-4 pr-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-neutral-800">{tech.nombre}</h3>
                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      tech.categoria === 'HARDWARE' ? 'bg-blue-50 text-blue-600' :
                      tech.categoria === 'SOFTWARE' ? 'bg-purple-50 text-purple-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {tech.categoria}
                    </span>
                  </div>
                  {tech.descripcion && <p className="text-xs text-neutral-500 mt-1">{tech.descripcion}</p>}
                </div>
              </div>

              {/* Grid Interno de Manuales Adjuntos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tech.archivos?.map((manual) => (
                  <a
                    key={manual.id}
                    href={manual.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded-lg hover:border-orange-300 shadow-sm transition group/item"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-neutral-400 group-hover/item:text-orange-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span className="text-xs font-semibold text-neutral-600 group-hover/item:text-neutral-800 truncate">
                        {manual.nombre}
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-neutral-400 uppercase bg-neutral-50 px-1 py-0.5 rounded shrink-0">
                      {manual.extension}
                    </span>
                  </a>
                ))}
                {(!tech.archivos || tech.archivos.length === 0) && (
                  <p className="text-xs text-neutral-400 italic">Este equipo no registra documentación en la zona global de I+D.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {enlazando && (
        <EnlazarTecnologiaModal 
          proyectoId={proyecto.id} 
          tecnologiasYaVinculadas={tecnologiasVinculadas}
          onClose={() => setEnlazando(false)} 
          onSuccess={() => { setEnlazando(false); onChange(); }} 
        />
      )}
    </div>
  );
}

function EnlazarTecnologiaModal({ proyectoId, tecnologiasYaVinculadas, onClose, onSuccess }: { proyectoId: number; tecnologiasYaVinculadas: Tecnologia[]; onClose: () => void; onSuccess: () => void }) {
  const [catalogoTech, setCatalogoTech] = useState<Tecnologia[]>([]);
  const [seleccionadaId, setSeleccionadaId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Tecnologia[]>("/proyectos/tecnologias/globales")
      .then((res) => {
        setCatalogoTech(res);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const disponibles = catalogoTech.filter(t => !tecnologiasYaVinculadas.some(ya => ya.id === t.id));

  async function guardar() {
    if (!seleccionadaId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/proyectos/${proyectoId}/tecnologias`, {
        method: "POST",
        body: JSON.stringify({ tecnologiaId: Number(seleccionadaId) })
      });
      showToast("Tecnología vinculada con éxito.", "success");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Error al vincular la tecnología.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Vincular Tecnología de I+D" onClose={onClose}>
      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-neutral-500">Cargando catálogo global…</p>
        ) : error ? (
          <p className="text-xs text-red-600">Error: {error}</p>
        ) : disponibles.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">No hay más tecnologías disponibles para vincular.</p>
        ) : (
          <div>
            <label className="text-xs font-bold text-neutral-500 block mb-1.5 uppercase tracking-wider">Selecciona el equipo o sistema</label>
            <select 
              value={seleccionadaId} 
              onChange={(e) => setSeleccionadaId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- Seleccionar del repositorio global --</option>
              {disponibles.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.nombre} ({tech.categoria})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
              Al enlazar la tecnología, todos sus manuales de instalación, datasheets y esquemas eléctricos quedarán accesibles de inmediato para la lectura del equipo técnico y gerencia dentro de este proyecto.
            </p>
          </div>
        )}

        {error && !loading && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
          <button onClick={onClose} disabled={saving} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={guardar} 
            disabled={!seleccionadaId || saving}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-sm"
          >
            {saving ? "Enlazando..." : "Confirmar Enlace"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProyectoTroubleshooting({ proyectoId, puedeEscribir }: { proyectoId: number; puedeEscribir: boolean }) {
  const [incidencias, setIncidencias] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [incidenciaEdicion, setIncidenciaEdicion] = useState<any | null>(null);

  function cargar() {
    setLoading(true);
    apiFetch<any[]>("/iot/troubleshooting")
      .then((inc) => {
        // Filtrar solo las de este proyecto
        setIncidencias(inc.filter((i) => i.proyectoId === proyectoId));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, [proyectoId]);

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta incidencia del registro?")) return;
    try {
      await apiFetch(`/iot/troubleshooting/${id}`, { method: "DELETE" });
      showToast("Incidencia eliminada con éxito", "success");
      cargar();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Error al eliminar", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-neutral-500 italic">Cargando bitácora de fallas…</p>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600 p-4">Error: {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-800">Bitácora de Incidencias / Fallas</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Historial de problemas de hardware o software vinculados a este proyecto.</p>
        </div>
        {puedeEscribir && (
          <button
            onClick={() => {
              setIncidenciaEdicion(null);
              setModalAbierto(true);
            }}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Registrar Falla
          </button>
        )}
      </div>

      {(incidencias ?? []).length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center">
          <p className="text-neutral-400 text-xs italic">No hay fallas reportadas para este proyecto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(incidencias ?? []).map((inc) => {
            const esHard = inc.tipo === "HARDWARE";
            const badgeTipo = esHard ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";
            const badgeEstado = inc.estado === "SOLUCIONADO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : inc.estado === "EN_PROCESO" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-rose-50 text-rose-700 border-rose-200";

            return (
              <div key={inc.id} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider border rounded px-1.5 py-0.5 ${badgeTipo}`}>
                        {inc.tipo === "HARDWARE" ? (
                          <>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            Hardware
                          </>
                        ) : (
                          <>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            Software
                          </>
                        )}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider border rounded px-1.5 py-0.5 ${badgeEstado}`}>
                        {inc.estado === "SOLUCIONADO" ? (
                          <>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Solucionado
                          </>
                        ) : inc.estado === "EN_PROCESO" ? (
                          <>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            En proceso
                          </>
                        ) : (
                          <>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Abierto
                          </>
                        )}
                      </span>
                    </div>
                    {puedeEscribir && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setIncidenciaEdicion(inc); setModalAbierto(true); }} className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-700 transition cursor-pointer">
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        </button>
                        <button onClick={() => handleEliminar(inc.id)} className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition cursor-pointer">
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-extrabold text-neutral-800 leading-snug mb-2">{inc.titulo}</h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Detalle</p>
                      <p className="text-neutral-600 bg-neutral-50 border border-neutral-100 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">{inc.descripcion}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Solución / Acción</p>
                      {inc.accionTomada ? (
                        <p className="text-neutral-600 bg-emerald-50/20 border border-emerald-100/50 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">{inc.accionTomada}</p>
                      ) : (
                        <p className="text-neutral-400 italic bg-neutral-50/30 p-2.5 rounded-lg">Sin solución registrada.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
                  <span>Por: {inc.autor.nombre}</span>
                  <span>{new Date(inc.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalAbierto && (
        <IncidenciaFormModal
          incidencia={incidenciaEdicion}
          proyectos={[]}
          proyectoIdFijo={proyectoId}
          onClose={() => setModalAbierto(false)}
          onSuccess={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

