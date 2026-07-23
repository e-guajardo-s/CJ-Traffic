import { useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { showToast } from "../../components/toast";
import type { Area } from "./types";

export default function Areas({ areas, onChange }: { areas: Area[]; onChange: () => void }) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [saving, setSaving] = useState(false);

  async function crear() {
    if (!nuevoNombre.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/admin/areas", { method: "POST", body: JSON.stringify({ nombre: nuevoNombre.trim() }) });
      showToast("Área creada", "success");
      setNuevoNombre("");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo crear el área", "error");
    } finally {
      setSaving(false);
    }
  }

  function iniciarEdicion(a: Area) {
    setEditandoId(a.id);
    setEditandoNombre(a.nombre);
  }

  async function guardarEdicion(id: number) {
    if (!editandoNombre.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/areas/${id}`, { method: "PATCH", body: JSON.stringify({ nombre: editandoNombre.trim() }) });
      showToast("Área actualizada", "success");
      setEditandoId(null);
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo actualizar el área", "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(a: Area) {
    if (!confirm(`¿Eliminar el área "${a.nombre}"?`)) return;
    try {
      await apiFetch(`/admin/areas/${a.id}`, { method: "DELETE" });
      showToast("Área eliminada", "success");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar el área", "error");
    }
  }

  const inputClass = "bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-1">Áreas de trabajo</h2>
      <p className="text-xs text-neutral-500 mb-5">
        Etiquetas organizativas (ej. Obras, Mantención) para agrupar usuarios y dirigir avisos. No afectan los permisos por módulo — eso lo define el rol.
      </p>

      <div className="flex items-center gap-2 mb-5">
        <input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crear(); } }}
          placeholder="Nombre de la nueva área…"
          className={`${inputClass} flex-1 max-w-xs`}
        />
        <button
          onClick={crear}
          disabled={saving || !nuevoNombre.trim()}
          className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer"
        >
          + Agregar área
        </button>
      </div>

      {areas.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">No hay áreas creadas todavía.</p>
      ) : (
        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3">
              {editandoId === a.id ? (
                <input
                  value={editandoNombre}
                  onChange={(e) => setEditandoNombre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarEdicion(a.id); } }}
                  className={`${inputClass} flex-1 max-w-xs`}
                  autoFocus
                />
              ) : (
                <span className="text-sm font-semibold text-neutral-700">{a.nombre}</span>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {editandoId === a.id ? (
                  <>
                    <button onClick={() => guardarEdicion(a.id)} disabled={saving} className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer">
                      Guardar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="text-xs font-semibold text-neutral-500 hover:text-neutral-700 cursor-pointer">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => iniciarEdicion(a)} className="text-xs font-semibold text-neutral-500 hover:text-orange-600 cursor-pointer">
                      Editar
                    </button>
                    <button onClick={() => eliminar(a)} className="text-xs font-semibold text-neutral-500 hover:text-red-500 cursor-pointer">
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
