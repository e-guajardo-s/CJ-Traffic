import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { renderMarkdown } from "./markdown";
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
  const [tab, setTab] = useState<"tareas" | "documentacion">("tareas");
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

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
            {proyecto.descripcion && <p className="text-sm text-neutral-500 mt-2 max-w-3xl leading-relaxed">{proyecto.descripcion}</p>}

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
        </div>
      </div>

      {tab === "tareas" ? (
        <KanbanBoard proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
      ) : (
        <Documentacion proyecto={proyecto} puedeEscribir={puedeEscribir} onChange={cargar} />
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
          <PaginaEditor key={seleccionada.id} pagina={seleccionada} puedeEscribir={puedeEscribir} onChange={onChange} />
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

function PaginaEditor({ pagina, puedeEscribir, onChange }: { pagina: ProyectoPagina; puedeEscribir: boolean; onChange: () => void }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(pagina.titulo);
  const [contenido, setContenido] = useState(pagina.contenido);
  const [saving, setSaving] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await apiFetch(`/proyectos/paginas/${pagina.id}`, {
        method: "PATCH",
        body: JSON.stringify({ titulo: titulo.trim() || pagina.titulo, contenido }),
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

  if (confirmandoBorrado) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          ¿Eliminar la página <span className="font-semibold">{pagina.titulo}</span>? No se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmandoBorrado(false)} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={eliminar} disabled={saving} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    );
  }

  if (editando) {
    return (
      <div className="space-y-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`${inputClass} font-bold text-base`} />
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={16}
          className={`${inputClass} font-mono text-sm`}
          placeholder="Escribe en markdown: **negrita**, *cursiva*, # Título, - lista, [enlace](url)…"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setTitulo(pagina.titulo);
              setContenido(pagina.contenido);
              setEditando(false);
            }}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
          >
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-base font-bold text-neutral-800">{pagina.titulo}</h2>
        {puedeEscribir && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditando(true)} className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md">
              Editar
            </button>
            <button onClick={() => setConfirmandoBorrado(true)} className="text-[11px] font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded-md">
              Eliminar
            </button>
          </div>
        )}
      </div>
      {pagina.contenido.trim() === "" ? (
        <p className="text-sm text-neutral-400">Página vacía.</p>
      ) : (
        <div className="text-sm text-neutral-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(pagina.contenido) }} />
      )}
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
