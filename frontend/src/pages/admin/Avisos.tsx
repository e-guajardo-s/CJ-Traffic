import { useState } from "react";
import { apiFetch, ApiError } from "../../api";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import type { Area, Aviso, AudienciaAviso, PresentacionAviso, Rol, TipoAviso } from "./types";

const TIPO_LABEL: Record<TipoAviso, string> = {
  INFO: "Info",
  MANTENCION: "Mantención",
  ADVERTENCIA: "Advertencia",
  URGENTE: "Urgente",
};
const TIPO_COLOR: Record<TipoAviso, string> = {
  INFO: "bg-sky-50 text-sky-700 border-sky-200",
  MANTENCION: "bg-amber-50 text-amber-700 border-amber-200",
  ADVERTENCIA: "bg-orange-50 text-orange-700 border-orange-200",
  URGENTE: "bg-red-50 text-red-700 border-red-200",
};
const PRESENTACION_LABEL: Record<PresentacionAviso, string> = { BANNER: "Banner", POPUP: "Popup" };

function fmtFecha(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Avisos({
  avisos,
  roles,
  areas,
  onChange,
}: {
  avisos: Aviso[];
  roles: Rol[];
  areas: Area[];
  onChange: () => void;
}) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Aviso | null>(null);

  async function toggleActivo(a: Aviso) {
    try {
      await apiFetch(`/admin/avisos/${a.id}`, { method: "PATCH", body: JSON.stringify({ activo: !a.activo }) });
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo actualizar el aviso", "error");
    }
  }

  async function eliminar(a: Aviso) {
    if (!confirm(`¿Eliminar el aviso "${a.titulo}"?`)) return;
    try {
      await apiFetch(`/admin/avisos/${a.id}`, { method: "DELETE" });
      showToast("Aviso eliminado", "success");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar el aviso", "error");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Avisos</h2>
        <button
          onClick={() => setCreando(true)}
          className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg cursor-pointer"
        >
          + Nuevo aviso
        </button>
      </div>
      <p className="text-xs text-neutral-500 mb-5">
        Banners persistentes o popups de una sola vez, dirigidos a todos, a un área, o a un rol específico. Útil para mantenciones programadas y comunicados.
      </p>

      {avisos.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">No hay avisos creados todavía.</p>
      ) : (
        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          {avisos.map((a) => (
            <div key={a.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${TIPO_COLOR[a.tipo]}`}>
                    {TIPO_LABEL[a.tipo]}
                  </span>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{PRESENTACION_LABEL[a.presentacion]}</span>
                  <span className="text-[10px] text-neutral-400">
                    · {a.audienciaTipo === "TODOS" ? "Todos" : `${a.audienciaTipo === "AREA" ? "Área" : "Rol"}: ${a.audienciaRef}`}
                  </span>
                  {!a.activo && <span className="text-[10px] font-bold text-neutral-400 uppercase">Inactivo</span>}
                </div>
                <p className="text-sm font-semibold text-neutral-800">{a.titulo}</p>
                <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{a.cuerpo}</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {a.autor.nombre}
                  {a.fechaProgramada && ` · Programado ${fmtFecha(a.fechaProgramada)}`}
                  {a.vigenteHasta && ` · Vigente hasta ${fmtFecha(a.vigenteHasta)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => toggleActivo(a)} className="text-xs font-semibold text-neutral-500 hover:text-orange-600 cursor-pointer">
                  {a.activo ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => setEditando(a)} className="text-xs font-semibold text-neutral-500 hover:text-orange-600 cursor-pointer">
                  Editar
                </button>
                <button onClick={() => eliminar(a)} className="text-xs font-semibold text-neutral-500 hover:text-red-500 cursor-pointer">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creando && (
        <AvisoModal roles={roles} areas={areas} onClose={() => setCreando(false)} onSaved={() => { setCreando(false); onChange(); }} />
      )}
      {editando && (
        <AvisoModal aviso={editando} roles={roles} areas={areas} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); onChange(); }} />
      )}
    </div>
  );
}

function AvisoModal({
  aviso,
  roles,
  areas,
  onClose,
  onSaved,
}: {
  aviso?: Aviso;
  roles: Rol[];
  areas: Area[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!aviso;
  const [titulo, setTitulo] = useState(aviso?.titulo ?? "");
  const [cuerpo, setCuerpo] = useState(aviso?.cuerpo ?? "");
  const [tipo, setTipo] = useState<TipoAviso>(aviso?.tipo ?? "INFO");
  const [presentacion, setPresentacion] = useState<PresentacionAviso>(aviso?.presentacion ?? "BANNER");
  const [audienciaTipo, setAudienciaTipo] = useState<AudienciaAviso>(aviso?.audienciaTipo ?? "TODOS");
  const [audienciaRef, setAudienciaRef] = useState(aviso?.audienciaRef ?? "");
  const [fechaProgramada, setFechaProgramada] = useState(aviso?.fechaProgramada?.slice(0, 10) ?? "");
  const [vigenteHasta, setVigenteHasta] = useState(aviso?.vigenteHasta?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!titulo.trim() || !cuerpo.trim()) {
      setError("Título y cuerpo son obligatorios.");
      return;
    }
    if (audienciaTipo !== "TODOS" && !audienciaRef) {
      setError(`Selecciona ${audienciaTipo === "AREA" ? "un área" : "un rol"} destinatario.`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        titulo: titulo.trim(),
        cuerpo: cuerpo.trim(),
        tipo,
        presentacion,
        audienciaTipo,
        audienciaRef: audienciaTipo === "TODOS" ? null : audienciaRef,
        fechaProgramada: fechaProgramada || null,
        vigenteHasta: vigenteHasta || null,
      };
      if (editando) {
        await apiFetch(`/admin/avisos/${aviso!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        showToast("Aviso actualizado", "success");
      } else {
        await apiFetch("/admin/avisos", { method: "POST", body: JSON.stringify(body) });
        showToast("Aviso creado", "success");
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar el aviso";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500";
  const chip = (activo: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`;

  return (
    <Modal title={editando ? "Editar aviso" : "Nuevo aviso"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Título *</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Mensaje *</label>
          <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Tipo</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TIPO_LABEL) as TipoAviso[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)} className={chip(tipo === t)}>
                {tipo === t && "✓ "}{TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Presentación</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PRESENTACION_LABEL) as PresentacionAviso[]).map((p) => (
              <button key={p} type="button" onClick={() => setPresentacion(p)} className={chip(presentacion === p)}>
                {presentacion === p && "✓ "}{PRESENTACION_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            {presentacion === "BANNER" ? "Se muestra siempre mientras esté vigente." : "Aparece como modal una sola vez por usuario."}
          </p>
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Dirigido a</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(["TODOS", "AREA", "ROL"] as AudienciaAviso[]).map((t) => (
              <button key={t} type="button" onClick={() => { setAudienciaTipo(t); setAudienciaRef(""); }} className={chip(audienciaTipo === t)}>
                {audienciaTipo === t && "✓ "}{t === "TODOS" ? "Todos" : t === "AREA" ? "Un área" : "Un rol"}
              </button>
            ))}
          </div>
          {audienciaTipo === "AREA" && (
            <select value={audienciaRef} onChange={(e) => setAudienciaRef(e.target.value)} className={inputClass}>
              <option value="">Selecciona un área…</option>
              {areas.map((a) => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </select>
          )}
          {audienciaTipo === "ROL" && (
            <select value={audienciaRef} onChange={(e) => setAudienciaRef(e.target.value)} className={inputClass}>
              <option value="">Selecciona un rol…</option>
              {roles.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Fecha programada (opcional)</label>
            <input type="date" value={fechaProgramada} onChange={(e) => setFechaProgramada(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Vigente hasta (opcional)</label>
            <input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear aviso"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
