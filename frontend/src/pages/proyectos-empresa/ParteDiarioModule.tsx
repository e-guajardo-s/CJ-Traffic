import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import { showToast } from "../../components/toast";
import CargandoTabla from "../../components/CargandoTabla";
import { ReporteDiarioPDF } from "./ReporteDiarioPDF";

type Clima = "DESPEJADO" | "NUBLADO" | "LLUVIA" | "VIENTO";

const CLIMA_LABEL: Record<Clima, string> = { DESPEJADO: "Despejado", NUBLADO: "Nublado", LLUVIA: "Lluvia", VIENTO: "Viento" };
const CLIMA_ICONO: Record<Clima, string> = { DESPEJADO: "☀️", NUBLADO: "☁️", LLUVIA: "🌧️", VIENTO: "💨" };

interface ReporteDiario {
  id: number;
  autor: { id: number; nombre: string };
  fecha: string;
  trackId: number | null;
  personal: number | null;
  clima: Clima | null;
  horasTrabajadas: string | null;
  trabajoRealizado: string;
  materiales: string | null;
  observaciones: string | null;
  createdAt: string;
}

interface TrackLite {
  id: number;
  tipo: string;
  nombre: string | null;
}

function labelTrackLite(tracks: TrackLite[], trackId: number | null): string | null {
  if (!trackId) return null;
  const t = tracks.find((tr) => tr.id === trackId);
  if (!t) return null;
  return t.nombre ?? t.tipo;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ParteDiarioModule({
  obraId, obraNombre, obraCodigo, tracks,
}: {
  obraId: number;
  obraNombre: string;
  obraCodigo: string;
  tracks: TrackLite[];
}) {
  const { usuario } = useAuth();
  const [reportes, setReportes] = useState<ReporteDiario[] | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [exportando, setExportando] = useState(false);
  const [editando, setEditando] = useState<ReporteDiario | null>(null);

  function cargar() {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const qs = params.toString();
    apiFetch<ReporteDiario[]>(`/proyectos-empresa/${obraId}/reportes-diarios${qs ? `?${qs}` : ""}`)
      .then(setReportes)
      .catch(() => showToast("No se pudieron cargar los partes diarios", "error"));
  }

  useEffect(cargar, [obraId, desde, hasta]);

  async function eliminar(r: ReporteDiario) {
    if (!confirm("¿Eliminar este parte diario?")) return;
    try {
      await apiFetch(`/proyectos-empresa/reportes-diarios/${r.id}`, { method: "DELETE" });
      showToast("Parte eliminado", "success");
      cargar();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    }
  }

  async function exportarPDF() {
    if (!reportes || reportes.length === 0) {
      showToast("No hay partes diarios en el rango seleccionado", "error");
      return;
    }
    setExportando(true);
    try {
      const blob = await pdf(
        <ReporteDiarioPDF
          obraNombre={obraNombre}
          obraCodigo={obraCodigo}
          desde={desde}
          hasta={hasta}
          reportes={reportes.map((r) => ({ ...r, trackLabel: labelTrackLite(tracks, r.trackId) }))}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${obraCodigo}_partes_diarios.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast("No se pudo generar el PDF", "error");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <NuevoParteForm obraId={obraId} tracks={tracks} onCreated={cargar} editando={editando} onDoneEditing={() => setEditando(null)} />

      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Partes registrados</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <span className="text-xs text-neutral-400">a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <button
              onClick={exportarPDF}
              disabled={exportando || !reportes || reportes.length === 0}
              className="text-xs font-semibold bg-neutral-800 hover:bg-black disabled:opacity-40 text-white px-3 py-2 rounded-lg cursor-pointer transition"
            >
              {exportando ? "Generando…" : "Exportar PDF"}
            </button>
          </div>
        </div>

        {!reportes ? (
          <CargandoTabla />
        ) : reportes.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">No hay partes diarios registrados en este rango.</p>
        ) : (
          <div className="space-y-2.5">
            {reportes.map((r) => {
              const trackLabel = labelTrackLite(tracks, r.trackId);
              const puedeEditar = usuario?.id === r.autor.id;
              return (
                <div key={r.id} className="border border-neutral-200 rounded-lg p-3.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-neutral-800">{new Date(r.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-600">{r.autor.nombre}</span>
                      {trackLabel && (
                        <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200 font-medium">{trackLabel}</span>
                      )}
                      {r.clima && <span title={CLIMA_LABEL[r.clima]}>{CLIMA_ICONO[r.clima]}</span>}
                      {r.personal != null && <span className="text-neutral-500">👷 {r.personal}</span>}
                      {r.horasTrabajadas != null && <span className="text-neutral-500">⏱ {Number(r.horasTrabajadas)}h</span>}
                    </div>
                    {puedeEditar && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setEditando(r)} className="text-[11px] font-semibold text-neutral-500 hover:text-orange-600 cursor-pointer">Editar</button>
                        <button onClick={() => eliminar(r)} className="text-[11px] font-semibold text-neutral-500 hover:text-red-500 cursor-pointer">Eliminar</button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-neutral-800 mt-2">{r.trabajoRealizado}</p>
                  {r.materiales && <p className="text-xs text-neutral-500 mt-1"><span className="font-semibold">Materiales:</span> {r.materiales}</p>}
                  {r.observaciones && <p className="text-xs text-neutral-500 mt-1"><span className="font-semibold">Observaciones:</span> {r.observaciones}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NuevoParteForm({
  obraId, tracks, onCreated, editando, onDoneEditing,
}: {
  obraId: number;
  tracks: TrackLite[];
  onCreated: () => void;
  editando: ReporteDiario | null;
  onDoneEditing: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [trackId, setTrackId] = useState("");
  const [clima, setClima] = useState<Clima | "">("");
  const [personal, setPersonal] = useState("");
  const [horasTrabajadas, setHorasTrabajadas] = useState("");
  const [trabajoRealizado, setTrabajoRealizado] = useState("");
  const [materiales, setMateriales] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editando) return;
    setFecha(editando.fecha.slice(0, 10));
    setTrackId(editando.trackId?.toString() ?? "");
    setClima(editando.clima ?? "");
    setPersonal(editando.personal?.toString() ?? "");
    setHorasTrabajadas(editando.horasTrabajadas?.toString() ?? "");
    setTrabajoRealizado(editando.trabajoRealizado);
    setMateriales(editando.materiales ?? "");
    setObservaciones(editando.observaciones ?? "");
  }, [editando]);

  function limpiar() {
    setFecha(hoyISO());
    setTrackId("");
    setClima("");
    setPersonal("");
    setHorasTrabajadas("");
    setTrabajoRealizado("");
    setMateriales("");
    setObservaciones("");
  }

  async function guardar() {
    if (!trabajoRealizado.trim()) {
      showToast("Describe el trabajo realizado", "error");
      return;
    }
    setSaving(true);
    const body = {
      fecha,
      trackId: trackId || null,
      clima: clima || null,
      personal: personal || null,
      horasTrabajadas: horasTrabajadas || null,
      trabajoRealizado: trabajoRealizado.trim(),
      materiales: materiales.trim() || null,
      observaciones: observaciones.trim() || null,
    };
    try {
      if (editando) {
        await apiFetch(`/proyectos-empresa/reportes-diarios/${editando.id}`, { method: "PATCH", body: JSON.stringify(body) });
        showToast("Parte actualizado", "success");
        onDoneEditing();
      } else {
        await apiFetch(`/proyectos-empresa/${obraId}/reportes-diarios`, { method: "POST", body: JSON.stringify(body) });
        showToast("Parte registrado", "success");
      }
      limpiar();
      onCreated();
    } catch (e: any) {
      showToast(e.message || "Error al guardar el parte", "error");
    } finally {
      setSaving(false);
    }
  }

  function cancelarEdicion() {
    limpiar();
    onDoneEditing();
  }

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500";
  const chip = (activo: boolean) =>
    `text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
        {editando ? "Editar parte diario" : "Registrar parte del día"}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Línea de trabajo</label>
          <select value={trackId} onChange={(e) => setTrackId(e.target.value)} className={inputClass}>
            <option value="">General (sin línea)</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.nombre ?? t.tipo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Personal en terreno</label>
          <input type="number" min={0} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="N°" className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Horas trabajadas</label>
          <input type="number" min={0} step={0.5} value={horasTrabajadas} onChange={(e) => setHorasTrabajadas(e.target.value)} placeholder="Hrs" className={inputClass} />
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Clima</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CLIMA_LABEL) as Clima[]).map((c) => (
            <button key={c} type="button" onClick={() => setClima(clima === c ? "" : c)} className={chip(clima === c)}>
              {CLIMA_ICONO[c]} {CLIMA_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Trabajo realizado *</label>
        <input value={trabajoRealizado} onChange={(e) => setTrabajoRealizado(e.target.value)} placeholder="Ej: Instalación de canalización tramo 2, 40 metros" className={inputClass} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Materiales utilizados</label>
          <input value={materiales} onChange={(e) => setMateriales(e.target.value)} placeholder="Opcional" className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Observaciones</label>
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3.5">
        {editando && (
          <button onClick={cancelarEdicion} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
        )}
        <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg cursor-pointer">
          {saving ? "Guardando…" : editando ? "Guardar cambios" : "Registrar parte"}
        </button>
      </div>
    </div>
  );
}
