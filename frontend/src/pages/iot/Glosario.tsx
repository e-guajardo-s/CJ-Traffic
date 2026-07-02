import { useState, useEffect } from "react";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import { showToast } from "../../components/toast";
import CargandoTabla from "../../components/CargandoTabla";

interface Termino {
  id: number;
  termino: string;
  definicion: string;
}

export default function GlosarioModule() {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");

  const [terminos, setTerminos] = useState<Termino[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [nuevoTermino, setNuevoTermino] = useState("");
  const [nuevaDefinicion, setNuevaDefinicion] = useState("");
  const [saving, setSaving] = useState(false);

  function cargar() {
    apiFetch<Termino[]>("/proyectos/glosario")
      .then(setTerminos)
      .catch((e) => {
        showToast(e.message || "Error al cargar el glosario técnico.", "error");
        setTerminos([]);
      });
  }

  useEffect(cargar, []);

  async function guardar() {
    if (!nuevoTermino.trim() || !nuevaDefinicion.trim()) {
      showToast("Tanto el término como la definición son campos requeridos.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/proyectos/glosario", {
        method: "POST",
        body: JSON.stringify({
          termino: nuevoTermino.trim(),
          definicion: nuevaDefinicion.trim(),
        }),
      });
      showToast("Término agregado correctamente.", "success");
      setNuevoTermino("");
      setNuevaDefinicion("");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al registrar el término en el glosario.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id: number, termino: string) {
    if (!confirm(`¿Eliminar la definición del término "${termino}"?`)) return;
    try {
      await apiFetch(`/proyectos/glosario/${id}`, { method: "DELETE" });
      showToast("Término eliminado del glosario.", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "No se pudo eliminar el término.", "error");
    }
  }

  if (terminos === null) return <CargandoTabla />;

  const texto = busqueda.trim().toLowerCase();
  const filtrados = texto
    ? terminos.filter((t) => t.termino.toLowerCase().includes(texto) || t.definicion.toLowerCase().includes(texto))
    : terminos;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm max-w-4xl">
      <div className="border-b border-neutral-100 pb-4 mb-6">
        <h2 className="text-lg font-black text-neutral-800">Glosario Técnico</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Las siglas y palabras técnicas definidas aquí se detectan y subrayan automáticamente en la documentación de los
          proyectos, y se incluyen como referencias en los reportes PDF.
        </p>
      </div>

      {puedeEscribir && (
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-4 rounded-xl mb-8">
          <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-widest mb-3">Añadir Palabra / Sigla</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={nuevoTermino}
              onChange={(e) => setNuevoTermino(e.target.value)}
              placeholder="Ej: TensorRT"
              disabled={saving}
              className="w-full sm:w-1/4 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              value={nuevaDefinicion}
              onChange={(e) => setNuevaDefinicion(e.target.value)}
              placeholder="Ej: Optimizador de inferencia de aprendizaje profundo de alto rendimiento para GPUs Nvidia."
              disabled={saving}
              className="w-full sm:w-3/4 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={guardar}
              disabled={saving}
              className="shrink-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-xs transition shadow-sm"
            >
              {saving ? "Guardando..." : "Añadir"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap px-1">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Términos registrados ({filtrados.length}
            {texto ? ` de ${terminos.length}` : ""})
          </h3>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar término…"
            className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {filtrados.length === 0 ? (
          <p className="text-xs text-neutral-400 italic p-4 text-center border border-dashed border-neutral-200 rounded-xl">
            {terminos.length === 0 ? "No hay términos registrados. Añade uno arriba." : "Ningún término coincide con la búsqueda."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtrados.map((t) => (
              <div
                key={t.id}
                className="group flex justify-between items-center p-4 border border-neutral-100 hover:border-orange-200/70 hover:shadow-sm bg-white rounded-xl transition duration-300"
              >
                <div className="pr-4">
                  <span className="font-extrabold text-sm text-neutral-800 hover:text-orange-600 transition-colors uppercase tracking-wide">
                    {t.termino}
                  </span>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{t.definicion}</p>
                </div>
                {puedeEscribir && (
                  <button
                    onClick={() => eliminar(t.id, t.termino)}
                    className="shrink-0 text-xs font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50/50 p-2 rounded-lg transition"
                    title="Eliminar término"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
