import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import CargandoTabla from "../../components/CargandoTabla";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function formatM(val: number) {
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + " MM";
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + " M";
  return clp.format(val);
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    "SOLICITADO": "bg-amber-100 text-amber-700 border-amber-200",
    "COTIZANDO": "bg-blue-100 text-blue-700 border-blue-200",
    "ORDEN_COMPRA": "bg-purple-100 text-purple-700 border-purple-200",
    "RECIBIDO": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "DESPACHADO": "bg-emerald-200 text-emerald-800 border-emerald-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${map[estado] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{label}</p>
      <p className={`text-2xl font-black ${accent ?? "text-neutral-800"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function MaterialesModule({ obraId }: { obraId?: number }) {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSol, setExpandedSol] = useState<number | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      if (obraId) {
        const res = await apiFetch<any[]>(`/proyectos-empresa/${obraId}/materiales`);
        setSolicitudes(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [obraId]);

  if (loading) return <div className="p-8"><CargandoTabla /></div>;

  const montoOC = solicitudes
    .filter(s => ["ORDEN_COMPRA", "RECIBIDO", "DESPACHADO"].includes(s.estado))
    .reduce((sum, s) => sum + Number(s.costoTotal || 0), 0);

  const montoRecibido = solicitudes
    .filter(s => ["RECIBIDO", "DESPACHADO"].includes(s.estado))
    .reduce((sum, s) => sum + Number(s.costoTotal || 0), 0);

  const enProceso = solicitudes.filter(s => ["SOLICITADO", "COTIZANDO"].includes(s.estado)).length;

  return (
    <div className="space-y-6 py-6">
      {/* Cabecera */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Materiales y Adquisiciones</h2>
        <p className="text-xs text-neutral-400 mt-0.5">{solicitudes.length} solicitud{solicitudes.length !== 1 ? "es" : ""} registrada{solicitudes.length !== 1 ? "s" : ""}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Solicitudes" value={`${solicitudes.length}`} />
        <KpiCard label="En Proceso / Cotizando" value={`${enProceso}`} accent="text-amber-600" />
        <KpiCard
          label="En Órdenes de Compra"
          value={formatM(montoOC)}
          sub="OC + Recibido + Despachado"
          accent="text-purple-600"
        />
        <KpiCard label="Recibido en Bodega" value={formatM(montoRecibido)} accent="text-emerald-600" />
      </div>

      {/* Tabla expandible */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Historial de Solicitudes</h3>
          <span className="text-[11px] text-neutral-400 italic">Las solicitudes se crean desde el track de Adquisiciones</span>
        </div>

        {solicitudes.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-neutral-400 italic">No hay solicitudes de materiales registradas.</p>
            <p className="text-xs text-neutral-400 mt-1">Créalas desde el kanban del track de Adquisiciones.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {solicitudes.map((sol) => {
              const isExpanded = expandedSol === sol.id;
              const totalItems = sol.items?.length ?? 0;

              return (
                <React.Fragment key={sol.id}>
                  {/* Fila principal */}
                  <button
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-neutral-50 transition ${isExpanded ? "bg-orange-50/40" : ""}`}
                    onClick={() => setExpandedSol(isExpanded ? null : sol.id)}
                  >
                    <svg className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-800">REQ-{sol.id.toString().padStart(4, "0")}</span>
                        <span className="text-xs text-neutral-400">{new Date(sol.fechaCreacion).toLocaleDateString("es-CL")}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">Solicitante: {sol.solicitante?.nombre ?? "—"}</p>
                    </div>

                    <div className="hidden md:flex items-center gap-8 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase">Ítems</p>
                        <p className="text-sm font-bold text-neutral-800 mt-0.5">{totalItems}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase">Costo Total</p>
                        <p className="text-sm font-bold text-neutral-800 mt-0.5">{sol.costoTotal ? formatM(Number(sol.costoTotal)) : "—"}</p>
                      </div>
                      <EstadoBadge estado={sol.estado} />
                    </div>
                  </button>

                  {/* Panel expandido: ítems */}
                  {isExpanded && (
                    <div className="bg-neutral-50/60 border-t border-neutral-100 px-5 py-4 pl-12">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Detalle de Ítems Solicitados</h4>
                      {sol.items && sol.items.length > 0 ? (
                        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                <th className="px-4 py-2.5">Cant.</th>
                                <th className="px-4 py-2.5">Descripción</th>
                                <th className="px-4 py-2.5 text-right">Precio Unit.</th>
                                <th className="px-4 py-2.5 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                              {sol.items.map((it: any) => {
                                const pu = Number(it.precioUnitario || 0);
                                const sub = pu * it.cantidad;
                                return (
                                  <tr key={it.id} className="hover:bg-neutral-50 transition">
                                    <td className="px-4 py-2.5 font-semibold text-neutral-700 w-12">{it.cantidad}</td>
                                    <td className="px-4 py-2.5 text-neutral-800">{it.articuloDesc}</td>
                                    <td className="px-4 py-2.5 text-right text-neutral-500">{pu > 0 ? clp.format(pu) : "—"}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-700">{sub > 0 ? clp.format(sub) : "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">Sin ítems registrados.</p>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Mini-resumen por estado */}
      {solicitudes.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">Distribución por Estado</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["SOLICITADO", "COTIZANDO", "ORDEN_COMPRA", "RECIBIDO", "DESPACHADO"].map(estado => {
              const count = solicitudes.filter(s => s.estado === estado).length;
              const pct = solicitudes.length > 0 ? (count / solicitudes.length) * 100 : 0;
              return (
                <div key={estado} className="text-center">
                  <p className="text-lg font-black text-neutral-800">{count}</p>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden my-1.5">
                    <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{estado.replace("_", " ")}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
