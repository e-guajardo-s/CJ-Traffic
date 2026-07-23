import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { esGerencia, esJefatura } from "../../roles";

interface UsuarioLite {
  id: number;
  nombre: string;
}

interface ObservacionSubtarea {
  id: number;
  contenido: string;
  createdAt: string;
  autor: UsuarioLite;
}

interface ObraSubtarea {
  id: number;
  titulo: string;
  estado: string;
  notas: string | null;
  observaciones: ObservacionSubtarea[];
}

interface ObraTrack {
  id: number;
  tipo: string;
  estadoActual: string;
  responsable: UsuarioLite | null;
  subtareas: ObraSubtarea[];
}

interface AlertaProyecto {
  obraId: number;
  obraNombre: string;
  riesgo: {
    nivel: string;
    motivo: string;
  };
  tracks: ObraTrack[];
}

interface TareaVencimiento {
  obraId: number;
  obraNombre: string;
  trackId: number;
  trackTipo: string;
  subtareaId: number;
  titulo: string;
  fechaVencimiento: string;
  estado: string;
}

interface AlertasResponse {
  alertas: AlertaProyecto[];
  tareasPorVencer: TareaVencimiento[];
}

export default function AlertasModule() {
  const { usuario } = useAuth();
  const puedeAdministrar = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);

  const [alertas, setAlertas] = useState<AlertaProyecto[] | null>(null);
  const [tareasPorVencer, setTareasPorVencer] = useState<TareaVencimiento[]>([]);
  const [observando, setObservando] = useState<{ obraId: number; subtarea: ObraSubtarea } | null>(null);

  function cargar() {
    apiFetch<AlertasResponse>("/proyectos-empresa/alertas/tareas")
      .then((res) => {
        setAlertas(res.alertas);
        setTareasPorVencer(res.tareasPorVencer);
      })
      .catch(() => {
        setAlertas([]);
        setTareasPorVencer([]);
      });
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!puedeAdministrar) {
    return <p className="text-sm text-red-600">No tienes permisos para ver esta sección.</p>;
  }

  if (!alertas) return <CargandoTabla />;

  const tareasVencidas = tareasPorVencer.filter(t => new Date(t.fechaVencimiento) < new Date());
  const proximasVencer = tareasPorVencer.filter(t => new Date(t.fechaVencimiento) >= new Date());

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Gestión de Alertas</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Proyectos en estado crítico. Permite a gerencia dejar observaciones directas en las tareas bloqueadas.
        </p>
      </div>

      {alertas.length === 0 && tareasPorVencer.length === 0 ? (
        <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center bg-emerald-50/30">
          <svg className="w-8 h-8 text-emerald-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="font-bold text-emerald-800">Todo en orden</p>
          <p className="text-sm text-emerald-600 mt-1">No hay proyectos bloqueados ni con atrasos críticos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-neutral-800">Proyectos Bloqueados</h3>
            {alertas.length === 0 ? (
              <p className="text-sm text-neutral-500 italic border border-neutral-200 rounded-xl p-4 bg-white">No hay proyectos bloqueados en este momento.</p>
            ) : (
              alertas.map((alerta) => (
            <div key={alerta.obraId} className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-red-50 px-5 py-4 border-b border-red-100 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <Link to={`/proyectos_empresa/detalle/${alerta.obraId}`} className="font-bold text-red-800 hover:underline">
                      {alerta.obraNombre}
                    </Link>
                  </div>
                  <p className="text-xs text-red-600 font-medium mt-1">{alerta.riesgo.motivo}</p>
                </div>
                <span className="inline-flex px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded uppercase border border-red-200 tracking-wide">
                  {alerta.riesgo.nivel}
                </span>
              </div>

              <div className="divide-y divide-neutral-100">
                {alerta.tracks.map((track) => (
                  <div key={track.id} className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">{track.tipo}</h4>
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold border bg-neutral-100 text-neutral-700 border-neutral-200">
                        {track.estadoActual}
                      </span>
                      {track.responsable && (
                        <span className="flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded-md ml-auto border border-neutral-200">
                          <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          {track.responsable.nombre}
                        </span>
                      )}
                    </div>

                    {track.subtareas.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">No hay tareas creadas en este track.</p>
                    ) : (
                      <ul className="space-y-3">
                        {track.subtareas.map((sub) => (
                          <li key={sub.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                            <div>
                              <Link 
                                to={`/proyectos_empresa/detalle/${alerta.obraId}/track/${track.id}`} 
                                state={{ openSubtareaId: sub.id }} 
                                className="text-sm font-bold text-blue-600 hover:underline"
                              >
                                {sub.titulo}
                              </Link>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-white px-1.5 py-0.5 rounded border border-neutral-200 shadow-sm">
                                  {sub.estado.replace("_", " ")}
                                </span>
                              </div>
                              {sub.observaciones && sub.observaciones.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <strong className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Últimas Observaciones</strong>
                                  {sub.observaciones.slice(-3).map((obs: any) => (
                                    <div key={obs.id} className="text-xs text-neutral-600 bg-white p-2.5 rounded-md border border-neutral-200 border-l-2 border-l-orange-400">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-[10px] text-orange-600">{obs.autor?.nombre}</span>
                                        <span className="text-[9px] text-neutral-400">{new Date(obs.createdAt).toLocaleDateString("es-CL")}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap">{obs.contenido}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setObservando({ obraId: alerta.obraId, subtarea: sub })}
                              className="shrink-0 text-xs font-semibold bg-white border border-neutral-300 hover:border-orange-500 hover:text-orange-600 text-neutral-700 px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                            >
                              Agregar Observación
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
              ))
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-neutral-800">Tareas Vencidas</h3>
            {tareasVencidas.length === 0 ? (
              <p className="text-sm text-neutral-500 italic border border-neutral-200 rounded-xl p-4 bg-white">No hay tareas atrasadas en este momento.</p>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm divide-y divide-neutral-100">
                {tareasVencidas.map((tarea) => (
                  <div key={tarea.subtareaId} className="p-4 hover:bg-neutral-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/proyectos_empresa/detalle/${tarea.obraId}/track/${tarea.trackId}`} state={{ openSubtareaId: tarea.subtareaId }} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-wide">
                          {tarea.obraNombre}
                        </Link>
                        <p className="text-sm font-semibold text-neutral-800 mt-0.5">{tarea.titulo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            {tarea.trackTipo}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            {tarea.estado.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span className="text-xs font-bold">
                          {new Date(tarea.fechaVencimiento).toLocaleDateString("es-CL", { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-lg font-bold text-neutral-800">Tareas Próximas a Vencer</h3>
            {proximasVencer.length === 0 ? (
              <p className="text-sm text-neutral-500 italic border border-neutral-200 rounded-xl p-4 bg-white">No hay tareas próximas a vencer.</p>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm divide-y divide-neutral-100">
                {proximasVencer.map((tarea) => (
                  <div key={tarea.subtareaId} className="p-4 hover:bg-neutral-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/proyectos_empresa/detalle/${tarea.obraId}/track/${tarea.trackId}`} state={{ openSubtareaId: tarea.subtareaId }} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-wide">
                          {tarea.obraNombre}
                        </Link>
                        <p className="text-sm font-semibold text-neutral-800 mt-0.5">{tarea.titulo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            {tarea.trackTipo}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            {tarea.estado.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-700">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span className="text-xs font-bold">
                          {new Date(tarea.fechaVencimiento).toLocaleDateString("es-CL", { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {observando && (
        <ObservacionModal
          subtarea={observando.subtarea}
          onClose={() => setObservando(null)}
          onSaved={() => {
            setObservando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function ObservacionModal({
  subtarea,
  onClose,
  onSaved,
}: {
  subtarea: ObraSubtarea;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nota.trim()) {
      showToast("Escribe una observación", "error");
      return;
    }
    setGuardando(true);
    try {
      await apiFetch(`/proyectos-empresa/subtareas/${subtarea.id}/observaciones`, {
        method: "POST",
        body: JSON.stringify({ contenido: nota.trim() }),
      });

      showToast("Observación guardada", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Agregar Observación Directa" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Tarea</p>
          <p className="text-sm text-neutral-800 bg-neutral-50 p-2 rounded-lg border border-neutral-200">
            {subtarea.titulo}
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
            Mensaje / Instrucción
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full h-24 bg-white border border-neutral-300 rounded-lg p-3 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none shadow-sm"
            placeholder="Ej: Se autoriza presupuesto extra, avanzar con la compra..."
            autoFocus
          />
          <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">
            Esta observación se añadirá a las notas de la tarea y quedará registrada en la bitácora del proyecto para notificar al coordinador.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg cursor-pointer shadow-sm transition"
          >
            {guardando ? "Guardando..." : "Enviar Observación"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
