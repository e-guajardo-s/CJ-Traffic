import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";

// ────────── Types ──────────

interface UsuarioLite { id: number; nombre: string; }

interface ObraLite {
  id: number;
  codigoObra: string;
  nombre: string;
  cliente: string;
  tipoObra: string;
  faseGlobal: string;
  avance: number;
  coordinador: UsuarioLite | null;
  tracks: ObraTrack[];
}

interface ObraTrack {
  id: number;
  tipo: string;
  estadoActual: string;
}

// ────────── Colors ──────────

const TRACK_COLORS: Record<string, string> = {
  PERMISOS: "bg-purple-100 text-purple-700 border-purple-200",
  ADQUISICIONES: "bg-blue-100 text-blue-700 border-blue-200",
  PROGRAMACION: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INSTALACION: "bg-orange-100 text-orange-700 border-orange-200",
};

const FASE_LABEL: Record<string, string> = {
  INICIO: "Inicio",
  GESTION: "Gestión",
  EJECUCION: "Ejecución",
  CERRADO: "Cerrado",
};

const TIPO_LABEL: Record<string, string> = {
  NUEVO_SEMAFORO: "Nuevo semáforo",
  MODIFICACION: "Modificación",
  CCTV: "CCTV",
  MANTENCION: "Mantención",
};

// ────────── Component ──────────

export default function ProyectosEmpresaModule() {
  const { usuario } = useAuth();
  const puedeAdministrar = usuario?.rol === "gerencia" || usuario?.rol === "jefatura";

  const [obras, setObras] = useState<ObraLite[] | null>(null);
  const [creando, setCreando] = useState(false);

  // Filtros
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [fase, setFase] = useState("");
  const [coord, setCoord] = useState("");

  function cargar() {
    apiFetch<ObraLite[]>("/proyectos-empresa")
      .then(setObras)
      .catch(() => setObras([]));
  }

  useEffect(cargar, []);

  async function eliminar(obra: ObraLite) {
    if (!confirm(`¿Eliminar el proyecto "${obra.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/proyectos-empresa/${obra.id}`, { method: "DELETE" });
      showToast("Proyecto eliminado", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
    }
  }

  const tiposDisponibles = useMemo(() => [...new Set((obras ?? []).map((o) => o.tipoObra))], [obras]);
  const coordsDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    (obras ?? []).forEach((o) => { if (o.coordinador) map.set(o.coordinador.id, o.coordinador.nombre); });
    return [...map.entries()];
  }, [obras]);

  const filtradas = useMemo(() => {
    return (obras ?? []).filter((o) => {
      if (q && !`${o.nombre} ${o.codigoObra} ${o.cliente}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (tipo && o.tipoObra !== tipo) return false;
      if (fase && o.faseGlobal !== fase) return false;
      if (coord && String(o.coordinador?.id ?? "") !== coord) return false;
      return true;
    });
  }, [obras, q, tipo, fase, coord]);

  if (!obras) return <CargandoTabla />;

  const selectClass = "bg-white border border-neutral-300 rounded-lg px-2.5 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Proyectos</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Motor operativo de la compañía: listado de proyectos y su avance.
          </p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg shadow-sm transition cursor-pointer"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Proyecto
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar proyecto, código o cliente…"
            className="w-full bg-white border border-neutral-300 rounded-lg pl-8 pr-3 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
          <option value="">Tipo: todos</option>
          {tiposDisponibles.map((t) => <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>)}
        </select>
        <select value={fase} onChange={(e) => setFase(e.target.value)} className={selectClass}>
          <option value="">Fase: todas</option>
          {Object.keys(FASE_LABEL).map((f) => <option key={f} value={f}>{FASE_LABEL[f]}</option>)}
        </select>
        <select value={coord} onChange={(e) => setCoord(e.target.value)} className={selectClass}>
          <option value="">Coordinador: todos</option>
          {coordsDisponibles.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        {(q || tipo || fase || coord) && (
          <button onClick={() => { setQ(""); setTipo(""); setFase(""); setCoord(""); }} className="text-xs font-semibold text-neutral-500 hover:text-orange-600 px-2 py-2 cursor-pointer">
            Limpiar
          </button>
        )}
        <span className="text-[11px] text-neutral-400 ml-auto">{filtradas.length} de {obras.length}</span>
      </div>

      {/* Tabla de proyectos */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-1/5">Proyecto</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Coordinador</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Tracks</th>
              <th className="px-4 py-3">Avance</th>
              {puedeAdministrar && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={puedeAdministrar ? 7 : 6} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {obras.length === 0 ? "No hay proyectos activos en el sistema." : "Ningún proyecto coincide con los filtros."}
                </td>
              </tr>
            ) : (
              filtradas.map((obra) => (
                <tr key={obra.id} className="hover:bg-neutral-50/50 transition">
                  <td className="px-4 py-4">
                    <Link to={`/proyectos_empresa/detalle/${obra.id}`} className="font-semibold text-sm text-orange-600 hover:underline cursor-pointer block">{obra.nombre}</Link>
                    <div className="text-xs text-neutral-500 mt-0.5">{obra.codigoObra}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{obra.cliente}</td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{obra.coordinador?.nombre ?? <span className="italic text-neutral-400">sin asignar</span>}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold tracking-wide border uppercase bg-neutral-100 text-neutral-700 border-neutral-200">
                      {FASE_LABEL[obra.faseGlobal] ?? obra.faseGlobal}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {["PERMISOS", "ADQUISICIONES", "PROGRAMACION", "INSTALACION"].map((tipo) => {
                        const track = obra.tracks.find((t) => t.tipo === tipo);
                        const colorClass = TRACK_COLORS[tipo] || "bg-neutral-100 text-neutral-700";
                        return track ? (
                          <span key={tipo} className={`inline-flex px-2 py-1 rounded text-[10px] font-bold tracking-wide border uppercase ${colorClass}`}>
                            {track.estadoActual.replace("_", " ")}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-[110px]">
                    <div className="h-2.5 w-full rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${obra.avance}%` }} />
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1">{obra.avance}%</div>
                  </td>
                  {puedeAdministrar && (
                    <td className="px-4 py-4">
                      <button
                        onClick={() => eliminar(obra)}
                        title="Eliminar proyecto"
                        className="text-neutral-300 hover:text-red-500 transition cursor-pointer"
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creando && <NuevaObraModal onClose={() => setCreando(false)} onCreated={() => { setCreando(false); cargar(); }} />}
    </div>
  );
}

// ────────── Modal Nueva Obra ──────────

import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { Link } from "react-router-dom";

function NuevaObraModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [codigoObra, setCodigoObra] = useState("");
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [tipoObra, setTipoObra] = useState("NUEVO_SEMAFORO");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  async function guardar() {
    if (!codigoObra.trim() || !nombre.trim() || !cliente.trim()) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/proyectos-empresa", {
        method: "POST",
        body: JSON.stringify({
          codigoObra: codigoObra.trim(),
          nombre: nombre.trim(),
          cliente: cliente.trim(),
          tipoObra
        })
      });
      showToast("Proyecto creado e inicializado", "success");
      onCreated();
    } catch (e: any) {
      showToast(e.message || "Error al crear", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Crear Nuevo Proyecto" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Código (ej: OBR-2024-001) *</label>
          <input value={codigoObra} onChange={(e) => setCodigoObra(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Semáforo Av. Kennedy" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Cliente *</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Tipo</label>
          <select value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} className={inputClass}>
            <option value="NUEVO_SEMAFORO">Nuevo Semáforo</option>
            <option value="MODIFICACION">Modificación de Cruce</option>
            <option value="CCTV">Sistema CCTV</option>
            <option value="MANTENCION">Mantención Correctiva</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer">
            {saving ? "Creando..." : "Crear e Inicializar Tracks"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
