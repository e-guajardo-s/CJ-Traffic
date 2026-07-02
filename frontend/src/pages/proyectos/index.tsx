import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import CargandoTabla from "../../components/CargandoTabla";
import Pizarra from "./Pizarra";
import { ESTADO_PROYECTO_COLOR, ESTADO_PROYECTO_LABEL, type EstadoProyecto, type Proyecto, type UsuarioLite } from "./types";

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function ProyectosModule() {
  const { puede } = useAuth();
  const [vista, setVista] = useState<"listado" | "pizarra">("listado");

  const tabClass = (activo: boolean) =>
    `text-xs font-bold px-4 py-2 rounded-lg transition-all ${
      activo ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl w-fit">
        <button onClick={() => setVista("listado")} className={tabClass(vista === "listado")}>
          Proyectos
        </button>
        <button onClick={() => setVista("pizarra")} className={tabClass(vista === "pizarra")}>
          Pizarra de Ideas
        </button>
      </div>

      {vista === "listado" ? (
        <ListadoProyectos />
      ) : (
        <Pizarra
          endpoint="/proyectos/pizarra-general"
          nombreArchivo="pizarra-ideas-desarrollo"
          puedeEscribir={puede("iot", "ESCRITURA")}
          titulo="Pizarra de Ideas del Área"
          descripcion="Lienzo compartido para idear antes de formalizar un proyecto. Cada proyecto tiene además su propia pizarra."
        />
      )}
    </div>
  );
}

function ListadoProyectos() {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoProyecto | "todos">("todos");
  const [creando, setCreando] = useState(false);

  function cargar() {
    apiFetch<Proyecto[]>("/proyectos")
      .then(setProyectos)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  const filtrados = useMemo(() => {
    if (!proyectos) return [];
    const texto = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (estadoFiltro !== "todos" && p.estado !== estadoFiltro) return false;
      if (texto && !p.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [proyectos, busqueda, estadoFiltro]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!proyectos) return <CargandoTabla />;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Proyectos</h2>
            <p className="text-xs text-neutral-500 mt-1">Proyectos tecnológicos/ingeniería del Área de Desarrollo.</p>
          </div>
          {puedeEscribir && (
            <button
              onClick={() => setCreando(true)}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
            >
              + Nuevo proyecto
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 my-4 flex-wrap">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
          />
          <span className="text-xs font-semibold text-neutral-500 ml-2">Estado:</span>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as EstadoProyecto | "todos")}
            className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="todos">Todos</option>
            {Object.entries(ESTADO_PROYECTO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-neutral-400">
            {filtrados.length} de {proyectos.length} proyectos
          </span>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
          <p className="text-sm text-neutral-500">
            {proyectos.length === 0 ? "Todavía no hay proyectos." : "Ningún proyecto coincide con el filtro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((p) => (
            <ProyectoCard key={p.id} proyecto={p} />
          ))}
        </div>
      )}

      {creando && (
        <NuevoProyectoModal
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function ProyectoCard({ proyecto }: { proyecto: Proyecto }) {
  const tareas = proyecto.tareas ?? [];
  const total = tareas.length;
  const hechas = tareas.filter((t) => t.estado === "HECHO").length;
  const progreso = total === 0 ? 0 : Math.round((hechas / total) * 100);

  return (
    <Link
      to={`/iot/proyectos/${proyecto.id}`}
      className="block group bg-white border border-neutral-200 rounded-2xl p-5 transition-all duration-300 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-neutral-800 group-hover:text-orange-600 transition-colors line-clamp-1">
          {proyecto.nombre}
        </h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 uppercase tracking-wider ${ESTADO_PROYECTO_COLOR[proyecto.estado]}`}>
          {ESTADO_PROYECTO_LABEL[proyecto.estado]}
        </span>
      </div>

      {proyecto.descripcion && (
        <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
          {proyecto.descripcion}
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5 font-medium">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-orange-500"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            <span>{hechas} de {total} tareas</span>
          </div>
          <span>{progreso}%</span>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100 text-[11px] text-neutral-500 font-medium">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span className="truncate max-w-[120px]">{proyecto.responsable ? proyecto.responsable.nombre : "Sin responsable"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
          <span>{proyecto._count?.paginas ?? 0} pág{proyecto._count?.paginas === 1 ? "" : "s"}</span>
        </div>
      </div>
    </Link>
  );
}

function NuevoProyectoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [usuarios, setUsuarios] = useState<UsuarioLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsuarioLite[]>("/proyectos/usuarios")
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const proyecto = await apiFetch<Proyecto>("/proyectos", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          responsableId: responsableId || null,
        }),
      });
      showToast(`${proyecto.nombre} creado.`, "success");
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo crear el proyecto";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo proyecto" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Migración firmware v3" autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className={inputClass} />
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

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
