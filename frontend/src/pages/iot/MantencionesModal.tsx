import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { TIPO_MANTENCION_LABEL, type Cruce, type Mantencion, type TipoMantencion } from "./types";

const TIPO_COLOR: Record<TipoMantencion, string> = {
  PREVENTIVA: "bg-emerald-100 text-emerald-700",
  CORRECTIVA: "bg-amber-100 text-amber-700",
  INSTALACION: "bg-sky-100 text-sky-700",
  RETIRO: "bg-rose-100 text-rose-700",
  OTRA: "bg-neutral-200 text-neutral-600",
};

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { timeZone: "UTC" });
}

export default function MantencionesModal({ cruce, onClose, onChange }: { cruce: Cruce; onClose: () => void; onChange: () => void }) {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");

  const [mantenciones, setMantenciones] = useState<Mantencion[] | null>(null);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<TipoMantencion>("PREVENTIVA");
  const [tecnico, setTecnico] = useState("");
  const [notas, setNotas] = useState("");

  function cargar() {
    apiFetch<Mantencion[]>(`/iot/gateways/${cruce.id}/mantenciones`)
      .then(setMantenciones)
      .catch(() => {
        setMantenciones([]);
        showToast("No se pudo cargar el historial de mantenciones", "error");
      });
  }

  useEffect(cargar, [cruce.id]);

  async function registrar() {
    if (!fecha) return;
    setSaving(true);
    try {
      await apiFetch(`/iot/gateways/${cruce.id}/mantenciones`, {
        method: "POST",
        body: JSON.stringify({ fecha, tipo, tecnico: tecnico || null, notas: notas || null }),
      });
      showToast("Mantención registrada.", "success");
      setMostrandoForm(false);
      setTecnico("");
      setNotas("");
      setTipo("PREVENTIVA");
      cargar();
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo registrar la mantención", "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id: number) {
    try {
      await apiFetch(`/iot/mantenciones/${id}`, { method: "DELETE" });
      showToast("Mantención eliminada.", "success");
      cargar();
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    }
  }

  return (
    <Modal title={`Historial de mantenciones — ${cruce.codigo}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-neutral-500 -mt-1">{cruce.ubicacion}</p>

        {mantenciones === null ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 rounded-lg bg-neutral-100" />
            <div className="h-12 rounded-lg bg-neutral-100" />
          </div>
        ) : mantenciones.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-neutral-300 rounded-xl">
            <p className="text-sm text-neutral-500">Sin mantenciones registradas para este gateway.</p>
            <p className="text-xs text-neutral-400 mt-1">Registra la primera visita a terreno con el botón de abajo.</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {mantenciones.map((m) => (
              <li key={m.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TIPO_COLOR[m.tipo]}`}>
                      {TIPO_MANTENCION_LABEL[m.tipo]}
                    </span>
                    <span className="text-sm font-semibold text-neutral-700">{formatFecha(m.fecha)}</span>
                    {m.tecnico && <span className="text-xs text-neutral-500 truncate">· {m.tecnico}</span>}
                  </div>
                  {puedeEscribir && (
                    <button
                      onClick={() => eliminar(m.id)}
                      className="text-[11px] font-bold text-red-500 hover:text-red-700 shrink-0"
                      title="Eliminar registro"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                {m.notas && <p className="text-xs text-neutral-600 mt-1.5 whitespace-pre-wrap">{m.notas}</p>}
              </li>
            ))}
          </ul>
        )}

        {puedeEscribir && !mostrandoForm && (
          <button
            onClick={() => setMostrandoForm(true)}
            className="w-full text-xs font-semibold bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-3 py-2.5 rounded-lg transition"
          >
            + Registrar mantención
          </button>
        )}

        {puedeEscribir && mostrandoForm && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 block mb-1.5">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1.5">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMantencion)} className={inputClass}>
                  {(Object.keys(TIPO_MANTENCION_LABEL) as TipoMantencion[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_MANTENCION_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">Técnico responsable (opcional)</label>
              <input value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Nombre de quien ejecutó el trabajo" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Trabajo realizado, repuestos usados, observaciones…"
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMostrandoForm(false)}
                className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={registrar}
                disabled={saving || !fecha}
                className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
              >
                {saving ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
