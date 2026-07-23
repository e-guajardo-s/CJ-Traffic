import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import { showToast } from "../../components/toast";
import Modal from "../../components/Modal";
import CargandoTabla from "../../components/CargandoTabla";

interface Incidencia {
  id: number;
  titulo: string;
  tipo: "HARDWARE" | "SOFTWARE";
  descripcion: string;
  fechaDescripcion: string | null;
  accionTomada: string | null;
  fechaAccion: string | null;
  estado: "ABIERTO" | "EN_PROCESO" | "SOLUCIONADO";
  fecha: string;
  proyectoId: number | null;
  proyecto: { id: number; nombre: string } | null;
  autor: { id: number; nombre: string };
}

interface ProyectoLite {
  id: number;
  nombre: string;
}

export default function TroubleshootingModule() {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");

  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("ALL");
  const [filtroEstado, setFiltroEstado] = useState<string>("ALL");
  const [filtroProyecto, setFiltroProyecto] = useState<string>("ALL");
  const [busqueda, setBusqueda] = useState<string>("");

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false);
  const [incidenciaEdicion, setIncidenciaEdicion] = useState<Incidencia | null>(null);

  function cargarDatos() {
    setLoading(true);
    Promise.all([
      apiFetch<Incidencia[]>("/iot/troubleshooting"),
      apiFetch<ProyectoLite[]>("/proyectos").catch(() => [])
    ])
      .then(([inc, proy]) => {
        setIncidencias(inc);
        setProyectos(proy);
        setError(null);
      })
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(cargarDatos, []);

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta incidencia del registro?")) return;
    try {
      await apiFetch(`/iot/troubleshooting/${id}`, { method: "DELETE" });
      showToast("Incidencia eliminada con éxito", "success");
      cargarDatos();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Error al eliminar", "error");
    }
  };

  const incidenciasFiltradas = (incidencias ?? []).filter((inc) => {
    if (filtroTipo !== "ALL" && inc.tipo !== filtroTipo) return false;
    if (filtroEstado !== "ALL" && inc.estado !== filtroEstado) return false;
    if (filtroProyecto !== "ALL" && String(inc.proyectoId) !== filtroProyecto) return false;
    if (busqueda.trim() !== "") {
      const q = busqueda.toLowerCase();
      const matchTitulo = inc.titulo.toLowerCase().includes(q);
      const matchDesc = inc.descripcion.toLowerCase().includes(q);
      const matchAccion = inc.accionTomada?.toLowerCase().includes(q) ?? false;
      const matchAutor = inc.autor.nombre.toLowerCase().includes(q);
      const matchProyecto = inc.proyecto?.nombre.toLowerCase().includes(q) ?? false;
      return matchTitulo || matchDesc || matchAccion || matchAutor || matchProyecto;
    }
    return true;
  });

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-semibold mb-4">Error al cargar la bitácora: {error}</p>
        <button onClick={cargarDatos} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-5 border-b border-neutral-100">
        <div>
          <h1 className="text-2xl font-black text-neutral-800 tracking-tight">Troubleshooting</h1>
          <p className="text-sm text-neutral-500 mt-1">Bitácora de fallas técnicas y soluciones documentadas de software y hardware.</p>
        </div>
        {puedeEscribir && (
          <button
            onClick={() => {
              setIncidenciaEdicion(null);
              setModalAbierto(true);
            }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Registrar Falla
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Buscar</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, descripción, solución o proyecto..."
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div className="w-40">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">Todos</option>
            <option value="HARDWARE">Hardware ⚙️</option>
            <option value="SOFTWARE">Software 💻</option>
          </select>
        </div>

        <div className="w-44">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">Todos</option>
            <option value="ABIERTO">Abierto 🔴</option>
            <option value="EN_PROCESO">En Proceso 🟡</option>
            <option value="SOLUCIONADO">Solucionado 🟢</option>
          </select>
        </div>

        <div className="w-52">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Proyecto enlazado</label>
          <select
            value={filtroProyecto}
            onChange={(e) => setFiltroProyecto(e.target.value)}
            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Listado de Fallas */}
      {loading ? (
        <CargandoTabla />
      ) : incidenciasFiltradas.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-neutral-400 text-sm">No se encontraron fallas registradas con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {incidenciasFiltradas.map((inc) => {
            const esHard = inc.tipo === "HARDWARE";
            const badgeTipo = esHard
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-blue-50 text-blue-700 border-blue-200";

            const badgeEstado =
              inc.estado === "SOLUCIONADO"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : inc.estado === "EN_PROCESO"
                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                : "bg-rose-50 text-rose-700 border-rose-200";

            return (
              <div key={inc.id} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider border rounded-md px-2 py-0.5 ${badgeTipo}`}>
                        {inc.tipo === "HARDWARE" ? (
                          <>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            Hardware
                          </>
                        ) : (
                          <>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            Software
                          </>
                        )}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider border rounded-md px-2 py-0.5 ${badgeEstado}`}>
                        {inc.estado === "SOLUCIONADO" ? (
                          <>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Solucionado
                          </>
                        ) : inc.estado === "EN_PROCESO" ? (
                          <>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            En proceso
                          </>
                        ) : (
                          <>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                        <button
                          onClick={() => {
                            setIncidenciaEdicion(inc);
                            setModalAbierto(true);
                          }}
                          className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-700 transition cursor-pointer"
                          title="Editar incidencia"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEliminar(inc.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition cursor-pointer"
                          title="Eliminar registro"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-neutral-800 tracking-tight leading-snug mb-2">
                    {inc.titulo}
                  </h3>

                  {inc.proyecto && (
                    <div className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-600 text-[11px] font-bold px-2 py-0.5 rounded-lg mb-3">
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M8 4v16M3 9h18" />
                      </svg>
                      {inc.proyecto.nombre}
                    </div>
                  )}

                  <div className="space-y-3 mt-1">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Descripción de la falla</p>
                        {inc.fechaDescripcion && (
                          <span className="text-[10px] font-semibold text-neutral-400">
                            {new Date(inc.fechaDescripcion).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                        {inc.descripcion}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Acción Tomada / Solución</p>
                        {inc.accionTomada && inc.fechaAccion && (
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {new Date(inc.fechaAccion).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      {inc.accionTomada ? (
                        <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed bg-emerald-50/30 rounded-xl p-3 border border-emerald-100/50">
                          {inc.accionTomada}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-400 italic bg-neutral-50/50 rounded-xl p-3 border border-neutral-100">
                          Ninguna solución registrada todavía.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-500">Por: {inc.autor.nombre}</span>
                  <span>{new Date(inc.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Registro / Edición */}
      {modalAbierto && (
        <IncidenciaFormModal
          incidencia={incidenciaEdicion}
          proyectos={proyectos}
          onClose={() => setModalAbierto(false)}
          onSuccess={() => {
            setModalAbierto(false);
            cargarDatos();
          }}
        />
      )}
    </div>
  );
}

export function IncidenciaFormModal({
  incidencia,
  proyectos,
  proyectoIdFijo,
  onClose,
  onSuccess,
}: {
  incidencia: Incidencia | null;
  proyectos: ProyectoLite[];
  proyectoIdFijo?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [titulo, setTitulo] = useState(incidencia?.titulo ?? "");
  const [tipo, setTipo] = useState<"HARDWARE" | "SOFTWARE">(incidencia?.tipo ?? "HARDWARE");
  const [descripcion, setDescripcion] = useState(incidencia?.descripcion ?? "");
  const [fechaDescripcion, setFechaDescripcion] = useState(incidencia?.fechaDescripcion?.slice(0, 10) ?? "");
  const [accionTomada, setAccionTomada] = useState(incidencia?.accionTomada ?? "");
  const [fechaAccion, setFechaAccion] = useState(incidencia?.fechaAccion?.slice(0, 10) ?? "");
  const [estado, setEstado] = useState<"ABIERTO" | "EN_PROCESO" | "SOLUCIONADO">(incidencia?.estado ?? "ABIERTO");
  const [proyectoId, setProyectoId] = useState<string>(
    proyectoIdFijo ? String(proyectoIdFijo) : (incidencia?.proyectoId ? String(incidencia.proyectoId) : "")
  );
  
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) {
      showToast("El título y la descripción son obligatorios", "error");
      return;
    }
    setGuardando(true);
    const body = {
      titulo: titulo.trim(),
      tipo,
      descripcion: descripcion.trim(),
      fechaDescripcion: fechaDescripcion || null,
      accionTomada: accionTomada.trim() || null,
      fechaAccion: fechaAccion || null,
      estado,
      proyectoId: proyectoId ? Number(proyectoId) : null,
    };
    try {
      if (incidencia) {
        await apiFetch(`/iot/troubleshooting/${incidencia.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        showToast("Falla actualizada con éxito", "success");
      } else {
        await apiFetch("/iot/troubleshooting", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Falla registrada con éxito", "success");
      }
      onSuccess();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title={incidencia ? "Editar Registro" : "Registrar Falla Técnica"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-neutral-600 block mb-1">Título de la falla *</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Reinicios continuos en módulo SIM800L"
            className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-neutral-600 block mb-1">Tipo de Falla</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "HARDWARE" | "SOFTWARE")}
              className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            >
              <option value="HARDWARE">Hardware ⚙️</option>
              <option value="SOFTWARE">Software 💻</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-600 block mb-1">Estado Operativo</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as "ABIERTO" | "EN_PROCESO" | "SOLUCIONADO")}
              className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            >
              <option value="ABIERTO">Abierto 🔴</option>
              <option value="EN_PROCESO">En Proceso 🟡</option>
              <option value="SOLUCIONADO">Solucionado 🟢</option>
            </select>
          </div>
        </div>

        {!proyectoIdFijo && (
          <div>
            <label className="text-xs font-bold text-neutral-600 block mb-1">Proyecto Vinculado (Opcional)</label>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            >
              <option value="">Ninguno (Falla general / no amarrada a proyecto)</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-neutral-600">Descripción detallada de la falla *</label>
            <input
              type="date"
              value={fechaDescripcion}
              onChange={(e) => setFechaDescripcion(e.target.value)}
              className="text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            />
          </div>
          <textarea
            required
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Especifica síntomas de la falla, lecturas físicas de multímetro/consola o logs de error observados..."
            className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-neutral-600">Acción Tomada / Solución Aplicada</label>
            <input
              type="date"
              value={fechaAccion}
              onChange={(e) => setFechaAccion(e.target.value)}
              className="text-xs bg-white border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            />
          </div>
          <textarea
            rows={3}
            value={accionTomada}
            onChange={(e) => setAccionTomada(e.target.value)}
            placeholder="Escribe la solución temporal, definitiva o el workaround empleado..."
            className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2.5 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg disabled:opacity-50 cursor-pointer"
          >
            {guardando ? "Guardando…" : "Guardar Registro"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
