import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../AuthContext";
import { apiFetch } from "../../api";
import { showToast } from "../../components/toast";
import Modal from "../../components/Modal";
import type { Tecnologia } from "../proyectos/types";

type CategoriaTech = "TODAS" | "HARDWARE" | "SOFTWARE" | "COMUNICACIONES";

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm";

export default function TecnologiasModule() {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");

  const [tecnologias, setTecnologias] = useState<Tecnologia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [categoria, setCategoria] = useState<CategoriaTech>("TODAS");
  const [busqueda, setBusqueda] = useState("");
  
  const [creandoTech, setCreandoTech] = useState(false);
  const [editandoTech, setEditandoTech] = useState<Tecnologia | null>(null);
  const [subiendoArchivoTechId, setSubiendoArchivoTechId] = useState<number | null>(null);

  function cargar() {
    setLoading(true);
    apiFetch<Tecnologia[]>("/proyectos/tecnologias/globales")
      .then((res) => {
        setTecnologias(res);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, []);

  async function eliminarTecnologia(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la tecnología "${nombre}" y toda su documentación asociada?`)) return;
    try {
      await apiFetch(`/proyectos/tecnologias/${id}`, { method: "DELETE" });
      showToast("Tecnología eliminada con éxito.", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "No se pudo eliminar la tecnología.", "error");
    }
  }

  async function eliminarArchivo(id: number) {
    if (!confirm("¿Eliminar este manual de la tecnología?")) return;
    try {
      await apiFetch(`/proyectos/archivos/${id}`, { method: "DELETE" });
      showToast("Manual eliminado.", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "No se pudo eliminar el archivo.", "error");
    }
  }

  const filtrados = useMemo(() => {
    return tecnologias.filter((t) => {
      if (categoria !== "TODAS" && t.categoria !== categoria) return false;
      if (busqueda && !t.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [tecnologias, busqueda, categoria]);

  if (loading) return <p className="text-sm text-neutral-500">Cargando tecnologías…</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error}</p>;

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-neutral-800 tracking-tight">Investigación y Tecnologías (I+D)</h1>
            <p className="text-sm text-neutral-500 mt-2 max-w-2xl leading-relaxed">
              Repositorio centralizado de tecnologías, manuales de equipos, esquemas eléctricos y configuraciones en fase de pruebas o uso general.
            </p>
          </div>
          {puedeEscribir && (
            <button 
              onClick={() => setCreandoTech(true)}
              className="flex items-center gap-2 shrink-0 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-all hover:-translate-y-0.5"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva Tecnología / Equipo
            </button>
          )}
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 pt-6 border-t border-neutral-100">
          <div className="relative w-full sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Buscar por equipo o tecnología..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {["TODAS", "HARDWARE", "SOFTWARE", "COMUNICACIONES"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoria(cat as CategoriaTech)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  categoria === cat 
                    ? "bg-neutral-800 text-white shadow-sm" 
                    : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {cat === "TODAS" ? "Todas" : cat === "HARDWARE" ? "Hardware" : cat === "SOFTWARE" ? "Software" : "Comunicaciones"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grilla de Tecnologías */}
      {filtrados.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-neutral-700">No hay tecnologías en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtrados.map((tech) => (
            <div key={tech.id} className="group relative bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-neutral-300 hover:shadow-md transition-all duration-300">
              {puedeEscribir && (
                <div className="absolute top-6 right-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditandoTech(tech)}
                    className="p-1 rounded-md text-neutral-400 hover:text-orange-600 hover:bg-orange-50"
                    title="Editar tecnología"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button
                    onClick={() => eliminarTecnologia(tech.id, tech.nombre)}
                    className="p-1 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50"
                    title="Eliminar tecnología"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              )}

              <div>
                {/* Encabezado de la Tarjeta */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                    tech.categoria === 'HARDWARE' ? 'bg-blue-50 text-blue-600' :
                    tech.categoria === 'SOFTWARE' ? 'bg-purple-50 text-purple-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {tech.categoria}
                  </span>
                  <span className="text-xs text-neutral-400 font-semibold pr-12">
                    {tech.archivos.length} documento{tech.archivos.length === 1 ? "" : "s"}
                  </span>
                </div>

                <h3 className="text-lg font-black text-neutral-800 tracking-tight">{tech.nombre}</h3>
                {tech.descripcion && (
                  <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed border-b border-neutral-100 pb-4">
                    {tech.descripcion}
                  </p>
                )}

                {/* Listado de Manuales Vinculados */}
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Documentación disponible</p>
                  
                  {tech.archivos.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic py-1">Sin manuales cargados aún.</p>
                  ) : (
                    tech.archivos.map((manual) => (
                      <div 
                        key={manual.id}
                        className="group/item flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-orange-50/30 hover:border-orange-200 transition-all"
                      >
                        <a
                          href={manual.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 overflow-hidden pr-2 flex-1"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-neutral-400 group-hover/item:text-orange-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span className="text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors truncate">
                            {manual.nombre}
                          </span>
                        </a>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-neutral-400 uppercase bg-white border px-1.5 py-0.5 rounded">
                            {manual.extension}
                          </span>
                          {puedeEscribir && (
                            <button
                              onClick={() => eliminarArchivo(manual.id)}
                              className="text-neutral-400 hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover/item:opacity-100"
                              title="Eliminar manual"
                            >
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Acción inferior para personal autorizado */}
              {puedeEscribir && (
                <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
                  <button 
                    onClick={() => setSubiendoArchivoTechId(tech.id)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Añadir manual a este equipo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creandoTech && (
        <CrearTecnologiaModal
          onClose={() => setCreandoTech(false)}
          onCreated={() => { setCreandoTech(false); cargar(); }}
        />
      )}

      {editandoTech && (
        <EditarTecnologiaModal
          tecnologia={editandoTech}
          onClose={() => setEditandoTech(null)}
          onSaved={() => { setEditandoTech(null); cargar(); }}
        />
      )}

      {subiendoArchivoTechId && (
        <SubirArchivoTechModal 
          tecnologiaId={subiendoArchivoTechId} 
          onClose={() => setSubiendoArchivoTechId(null)} 
          onUploaded={() => { setSubiendoArchivoTechId(null); cargar(); }} 
        />
      )}
    </div>
  );
}

function CrearTecnologiaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<"HARDWARE" | "SOFTWARE" | "COMUNICACIONES">("HARDWARE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/proyectos/tecnologias", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria,
          proyectoId: null, // Global
        }),
      });
      showToast("Tecnología registrada con éxito.", "success");
      onCreated();
    } catch (e: any) {
      setError(e.message || "Error al registrar la tecnología.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nueva Tecnología / Equipo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Nombre del Equipo</label>
          <input 
            value={nombre} 
            onChange={(e) => setNombre(e.target.value)} 
            className={inputClass} 
            placeholder="Ej: Radar de Velocidad Smart Traffic" 
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Categoría</label>
          <select 
            value={categoria} 
            onChange={(e) => setCategoria(e.target.value as any)} 
            className={inputClass}
          >
            <option value="HARDWARE">Hardware (Equipos, Dispositivos)</option>
            <option value="SOFTWARE">Software (Algoritmos, Bloques PLC)</option>
            <option value="COMUNICACIONES">Comunicaciones (MQTT, Radioenlace)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Descripción</label>
          <textarea 
            value={descripcion} 
            onChange={(e) => setDescripcion(e.target.value)} 
            rows={3} 
            className={inputClass} 
            placeholder="Ej: Unidad de medición de velocidad doppler por microondas." 
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button 
            onClick={onClose} 
            disabled={saving}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
          >
            Cancelar
          </button>
          <button 
            onClick={guardar} 
            disabled={saving} 
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Registrando…" : "Registrar Equipo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditarTecnologiaModal({ tecnologia, onClose, onSaved }: { tecnologia: Tecnologia; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(tecnologia.nombre);
  const [descripcion, setDescripcion] = useState(tecnologia.descripcion ?? "");
  const [categoria, setCategoria] = useState<"HARDWARE" | "SOFTWARE" | "COMUNICACIONES">(tecnologia.categoria as "HARDWARE" | "SOFTWARE" | "COMUNICACIONES");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/proyectos/tecnologias/${tecnologia.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria,
        }),
      });
      showToast("Tecnología actualizada con éxito.", "success");
      onSaved();
    } catch (e: any) {
      setError(e.message || "Error al actualizar la tecnología.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Editar Tecnología / Equipo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Nombre del Equipo</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClass}
            placeholder="Ej: Radar de Velocidad Smart Traffic"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as any)}
            className={inputClass}
          >
            <option value="HARDWARE">Hardware (Equipos, Dispositivos)</option>
            <option value="SOFTWARE">Software (Algoritmos, Bloques PLC)</option>
            <option value="COMUNICACIONES">Comunicaciones (MQTT, Radioenlace)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Ej: Unidad de medición de velocidad doppler por microondas."
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Guardando…" : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SubirArchivoTechModal({ tecnologiaId, onClose, onUploaded }: { tecnologiaId: number; onClose: () => void; onUploaded: () => void }) {
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!nombre) {
        const dotIndex = selectedFile.name.lastIndexOf('.');
        const defaultName = dotIndex !== -1 ? selectedFile.name.substring(0, dotIndex) : selectedFile.name;
        setNombre(defaultName);
      }
    }
  };

  const guardar = () => {
    if (!file) {
      setError("Debes seleccionar un archivo.");
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre del manual es obligatorio.");
      return;
    }

    setSubiendo(true);
    setError(null);

    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? file.name.substring(dotIndex + 1).toLowerCase() : 'bin';

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        await apiFetch(`/proyectos/tecnologias/${tecnologiaId}/archivos`, {
          method: "POST",
          body: JSON.stringify({
            nombre: nombre.trim(),
            extension: ext,
            archivoBase64: base64
          })
        });
        showToast("Manual añadido correctamente.", "success");
        onUploaded();
      } catch (err: any) {
        setError(err.message || "No se pudo subir el manual.");
      } finally {
        setSubiendo(false);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo.");
      setSubiendo(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Añadir Manual / Documento" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Archivo</label>
          <input 
            type="file" 
            onChange={handleFileChange} 
            className="w-full text-xs text-neutral-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer" 
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5 font-bold uppercase tracking-wider">Nombre del Documento</label>
          <input 
            value={nombre} 
            onChange={(e) => setNombre(e.target.value)} 
            className={inputClass} 
            placeholder="Ej: Manual de Instalación Física" 
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <button 
            onClick={onClose} 
            disabled={subiendo}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
          >
            Cancelar
          </button>
          <button 
            onClick={guardar} 
            disabled={subiendo} 
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {subiendo ? "Subiendo…" : "Añadir Documento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
