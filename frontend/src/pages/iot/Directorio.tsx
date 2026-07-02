import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { categoriaCiclo, CATEGORIA_LABEL, ESTADO_GATEWAY_LABEL, type CategoriaCiclo, type Cruce, type EstadoGateway } from "./types";
import GatewayCampos, { gatewayCamposIniciales, type GatewayCamposValue } from "./GatewayCampos";
import NuevoCruceModal from "./NuevoCruceModal";
import MantencionesModal from "./MantencionesModal";
import type { ItemInventario } from "./inventarioTypes";
import { disponibles } from "./inventarioTypes";

const FILA_COLOR: Record<CategoriaCiclo, string> = {
  verde: "bg-emerald-50/60 hover:bg-emerald-50",
  gris: "bg-neutral-50/60 hover:bg-neutral-100",
  sinInstalar: "bg-red-50/60 hover:bg-red-50",
  desinstalado: "bg-rose-50/60 hover:bg-rose-50",
};

const BADGE_COLOR: Record<CategoriaCiclo, string> = {
  verde: "bg-emerald-100 text-emerald-700",
  gris: "bg-neutral-200 text-neutral-600",
  sinInstalar: "bg-red-100 text-red-700",
  desinstalado: "bg-rose-100 text-rose-700",
};

const CATEGORIAS: CategoriaCiclo[] = ["verde", "gris", "sinInstalar", "desinstalado"];

const ESTADO_BADGE: Record<EstadoGateway, { dot: string; chip: string }> = {
  ONLINE: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  OFFLINE: { dot: "bg-red-500", chip: "bg-red-100 text-red-700" },
  DEGRADADO: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
};

const ESTADOS_GATEWAY: EstadoGateway[] = ["ONLINE", "OFFLINE", "DEGRADADO"];

type ColumnaOrden = "codigo" | "ubicacion" | "instalacion";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL");
}

export default function IotDirectorio({ cruces, onChange }: { cruces: Cruce[]; onChange: () => void }) {
  const { puede } = useAuth();
  const [editando, setEditando] = useState<Cruce | null>(null);
  const [eliminando, setEliminando] = useState<Cruce | null>(null);
  const [verMantenciones, setVerMantenciones] = useState<Cruce | null>(null);
  const [creando, setCreando] = useState(false);
  const [filtro, setFiltro] = useState<CategoriaCiclo | "todos">("todos");
  const [filtroEstado, setFiltroEstado] = useState<EstadoGateway | "todos">("todos");
  const [filtroControlador, setFiltroControlador] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ col: ColumnaOrden; asc: boolean } | null>(null);
  const [exportando, setExportando] = useState(false);

  const controladores = useMemo(
    () => Array.from(new Set(cruces.map((c) => c.controlador).filter(Boolean))).sort(),
    [cruces],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const resultado = cruces.filter((c) => {
      if (filtro !== "todos" && categoriaCiclo(c.gateway) !== filtro) return false;
      if (filtroEstado !== "todos" && c.gateway?.estado !== filtroEstado) return false;
      if (filtroControlador !== "todos" && c.controlador !== filtroControlador) return false;
      if (texto && !c.codigo.toLowerCase().includes(texto) && !c.ubicacion.toLowerCase().includes(texto)) return false;
      return true;
    });

    if (orden) {
      const dir = orden.asc ? 1 : -1;
      resultado.sort((a, b) => {
        if (orden.col === "codigo") return a.codigo.localeCompare(b.codigo, undefined, { numeric: true }) * dir;
        if (orden.col === "ubicacion") return a.ubicacion.localeCompare(b.ubicacion) * dir;
        // instalacion: nulls al final independiente de la dirección
        const fa = a.gateway?.fechaInstalacion;
        const fb = b.gateway?.fechaInstalacion;
        if (!fa && !fb) return 0;
        if (!fa) return 1;
        if (!fb) return -1;
        return (new Date(fa).getTime() - new Date(fb).getTime()) * dir;
      });
    }
    return resultado;
  }, [cruces, filtro, filtroEstado, filtroControlador, busqueda, orden]);

  function toggleOrden(col: ColumnaOrden) {
    setOrden((o) => (o?.col === col ? (o.asc ? { col, asc: false } : null) : { col, asc: true }));
  }

  const puedeEscribir = puede("iot", "ESCRITURA");

  async function exportar() {
    setExportando(true);
    try {
      const { exportarDirectorioExcel } = await import("./excelExport");
      await exportarDirectorioExcel(filtrados);
    } catch {
      showToast("No se pudo generar el archivo Excel", "error");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Mantenedor — Directorio de Telemetría IoT</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Cruce semafórico ↔ Controlador ↔ Gateway de telemetría. Administrado por Desarrollo Tecnológico.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportar}
            disabled={exportando}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
          >
            {exportando ? "Generando…" : "Exportar a Excel"}
          </button>
          {puedeEscribir && (
            <button
              onClick={() => setCreando(true)}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
            >
              + Registrar Cruce
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 my-4 flex-wrap">
        <div className="relative">
          <svg
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o ubicación…"
            className="bg-white border border-neutral-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as CategoriaCiclo | "todos")}
          className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="Filtrar por categoría de ciclo de vida"
        >
          <option value="todos">Categoría: todas</option>
          {CATEGORIAS.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORIA_LABEL[cat]}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoGateway | "todos")}
          className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="Filtrar por estado de conectividad"
        >
          <option value="todos">Conectividad: todas</option>
          {ESTADOS_GATEWAY.map((e) => (
            <option key={e} value={e}>
              {ESTADO_GATEWAY_LABEL[e]}
            </option>
          ))}
        </select>
        {controladores.length > 1 && (
          <select
            value={filtroControlador}
            onChange={(e) => setFiltroControlador(e.target.value)}
            className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Filtrar por controlador"
          >
            <option value="todos">Controlador: todos</option>
            {controladores.map((ctrl) => (
              <option key={ctrl} value={ctrl}>
                {ctrl}
              </option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-neutral-400">
          {filtrados.length} de {cruces.length} cruces
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-24" />
            <col className="w-48" />
            <col className="w-36" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-32" />
            <col className={puedeEscribir ? "w-48" : "w-28"} />
          </colgroup>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-200">
              <ThOrdenable label="ID Cruce" col="codigo" orden={orden} onToggle={toggleOrden} />
              <ThOrdenable label="Ubicación" col="ubicacion" orden={orden} onToggle={toggleOrden} />
              <th className="py-3 pr-4">Modelo Gateway</th>
              <ThOrdenable label="Instalación" col="instalacion" orden={orden} onToggle={toggleOrden} />
              <th className="py-3 pr-4">Desinstalación</th>
              <th className="py-3 pr-4">Mantenciones</th>
              <th className="py-3 pr-4">Conectividad</th>
              <th className="py-3 pr-4">Categoría</th>
              <th className="py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <p className="text-sm text-neutral-500">
                    {cruces.length === 0 ? "Aún no hay cruces registrados en el directorio." : "Ningún cruce coincide con la búsqueda o los filtros."}
                  </p>
                  {cruces.length === 0 && puedeEscribir && (
                    <button onClick={() => setCreando(true)} className="mt-3 text-xs font-semibold text-orange-600 hover:text-orange-700">
                      + Registrar el primer cruce
                    </button>
                  )}
                </td>
              </tr>
            )}
            {filtrados.map((c) => {
              const cat = categoriaCiclo(c.gateway);
              const estado = c.gateway?.estado;
              const nMantenciones = c.gateway?.mantenciones?.length ?? 0;
              return (
                <tr key={c.id} className={`transition-colors ${FILA_COLOR[cat]}`}>
                  <td className="py-3 pr-4 font-mono font-bold text-orange-600 truncate">{c.codigo}</td>
                  <td className="py-3 pr-4 text-neutral-700 truncate">{c.ubicacion}</td>
                  <td className="py-3 pr-4 font-mono text-violet-600 truncate">{c.gateway?.modelo ?? "—"}</td>
                  <td className="py-3 pr-4 text-neutral-600">{formatFecha(c.gateway?.fechaInstalacion ?? null)}</td>
                  <td className="py-3 pr-4 text-neutral-600">{formatFecha(c.gateway?.fechaDesinstalacion ?? null)}</td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => setVerMantenciones(c)}
                      className="text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-md"
                      title="Ver historial de mantenciones"
                    >
                      {nMantenciones > 0 ? `${nMantenciones} registro${nMantenciones !== 1 ? "s" : ""}` : "Historial"}
                    </button>
                  </td>
                  <td className="py-3 pr-4">
                    {estado ? (
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_BADGE[estado].chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_BADGE[estado].dot}`} />
                        {ESTADO_GATEWAY_LABEL[estado]}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${BADGE_COLOR[cat]}`}>{CATEGORIA_LABEL[cat]}</span>
                  </td>
                  <td className="py-3">
                    {puedeEscribir ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditando(c)}
                          className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setEliminando(c)}
                          className="text-[11px] font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded-md"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarGatewayModal
          cruce={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            onChange();
          }}
        />
      )}

      {creando && (
        <NuevoCruceModal
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            onChange();
          }}
        />
      )}

      {eliminando && (
        <EliminarCruceModal
          cruce={eliminando}
          onClose={() => setEliminando(null)}
          onDeleted={() => {
            setEliminando(null);
            onChange();
          }}
        />
      )}

      {verMantenciones && (
        <MantencionesModal cruce={verMantenciones} onClose={() => setVerMantenciones(null)} onChange={onChange} />
      )}
    </div>
  );
}

function ThOrdenable({
  label,
  col,
  orden,
  onToggle,
}: {
  label: string;
  col: ColumnaOrden;
  orden: { col: ColumnaOrden; asc: boolean } | null;
  onToggle: (col: ColumnaOrden) => void;
}) {
  const activo = orden?.col === col;
  return (
    <th className="py-3 pr-4">
      <button
        onClick={() => onToggle(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-neutral-600 transition-colors ${activo ? "text-orange-600" : ""}`}
        title={`Ordenar por ${label.toLowerCase()}`}
      >
        {label}
        <span className="text-[9px] leading-none">{activo ? (orden!.asc ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function EditarGatewayModal({ cruce, onClose, onSaved }: { cruce: Cruce; onClose: () => void; onSaved: () => void }) {
  const [ubicacion, setUbicacion] = useState(cruce.ubicacion);
  const [controlador, setControlador] = useState(cruce.controlador);
  const [gateway, setGateway] = useState<GatewayCamposValue>(gatewayCamposIniciales(cruce.gateway));
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await apiFetch(`/iot/gateways/${cruce.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ubicacion,
          controlador,
          modelo: gateway.modelo || null,
          estado: gateway.estado,
          fechaInstalacion: gateway.fechaInstalacion || null,
          fechaDesinstalacion: gateway.fechaDesinstalacion || null,
          enMantencion: gateway.enMantencion,
        }),
      });
      showToast(`Cruce ${cruce.codigo} actualizado.`, "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <Modal title={`Editar cruce — ${cruce.codigo}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Ubicación</label>
            <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Controlador</label>
            <input value={controlador} onChange={(e) => setControlador(e.target.value)} className={inputClass} />
          </div>
        </div>

        <GatewayCampos value={gateway} onChange={(patch) => setGateway((g) => ({ ...g, ...patch }))} />

        <UnidadAsignadaSection cruce={cruce} onCambio={onSaved} />

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// La misma operación de asignar/retirar unidades de inventario que existe en
// la pantalla de Inventario, disponible también desde el Directorio.
function UnidadAsignadaSection({ cruce, onCambio }: { cruce: Cruce; onCambio: () => void }) {
  const [items, setItems] = useState<ItemInventario[] | null>(null);
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<ItemInventario[]>("/iot/inventario/items")
      .then(setItems)
      .catch(() => setItems([]));
  }, [cruce.unidadesAsignadas.length]);

  async function retirar(unidadIdRetirar: number) {
    setSaving(true);
    try {
      await apiFetch(`/iot/inventario/unidades/${unidadIdRetirar}/asignacion`, {
        method: "PATCH",
        body: JSON.stringify({ cruceId: null }),
      });
      showToast("Unidad retirada del cruce.", "success");
      onCambio();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo retirar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function asignar() {
    if (!unidadId) return;
    setSaving(true);
    try {
      await apiFetch(`/iot/inventario/unidades/${unidadId}/asignacion`, {
        method: "PATCH",
        body: JSON.stringify({ cruceId: cruce.id }),
      });
      showToast("Unidad asignada.", "success");
      setUnidadId("");
      onCambio();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo asignar", "error");
    } finally {
      setSaving(false);
    }
  }

  const unidadesDisponibles = items?.flatMap((i) => disponibles(i).map((u) => ({ ...u, itemNombre: i.nombre }))) ?? [];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-semibold text-neutral-600 mb-2">Unidades de inventario asignadas</p>

      {cruce.unidadesAsignadas.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {cruce.unidadesAsignadas.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-700">
                {u.item.nombre} #{u.codigoUnidad}
              </span>
              <button
                onClick={() => retirar(u.id)}
                disabled={saving}
                className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md disabled:opacity-50"
              >
                Retirar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-400 mb-3">Sin unidades asignadas.</p>
      )}

      {items === null ? (
        <p className="text-xs text-neutral-400">Cargando unidades disponibles…</p>
      ) : unidadesDisponibles.length === 0 ? (
        <p className="text-xs text-neutral-400">No hay unidades disponibles para asignar.</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={unidadId}
            onChange={(e) => setUnidadId(Number(e.target.value))}
            className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Agregar unidad…</option>
            {unidadesDisponibles.map((u) => (
              <option key={u.id} value={u.id}>
                {u.itemNombre} #{u.codigoUnidad}
              </option>
            ))}
          </select>
          <button
            onClick={asignar}
            disabled={saving || !unidadId}
            className="text-[11px] font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-md"
          >
            Asignar
          </button>
        </div>
      )}
    </div>
  );
}

function EliminarCruceModal({ cruce, onClose, onDeleted }: { cruce: Cruce; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function eliminar() {
    setDeleting(true);
    try {
      await apiFetch(`/iot/cruces/${cruce.id}`, { method: "DELETE" });
      showToast(`Gateway de ${cruce.codigo} eliminado del directorio.`, "success");
      onDeleted();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal title="Eliminar gateway" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          ¿Eliminar el gateway de monitoreo de <span className="font-mono font-bold text-orange-600">{cruce.codigo}</span> ({cruce.ubicacion})?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={eliminar}
            disabled={deleting}
            className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
