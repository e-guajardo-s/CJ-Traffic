import React, { useEffect, useRef, useState } from "react";
import { apiFetch, getToken } from "../../api";
import { useAuth } from "../../AuthContext";
import CargandoTabla from "../../components/CargandoTabla";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { esGerencia, esJefatura } from "../../roles";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function formatM(val: number) {
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + " MM";
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + " M";
  return clp.format(val);
}

function EpBadge({ estado }: { estado: string }) {
  const cls: Record<string, string> = {
    "PAGADO": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "EN REVISIÓN": "bg-orange-100 text-orange-700 border-orange-200",
    "PENDIENTE": "bg-amber-100 text-amber-700 border-amber-200",
    "APROBADO": "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cls[estado] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
      {estado}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{label}</p>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

const SEGMENT_COLORS = ["bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-teal-500", "bg-rose-500", "bg-cyan-500"];

// El "plan" de un contrato es siempre 100%; el avance real se sigue por
// Estado de Pago. Cada EP aporta un tramo a la barra general: el delta entre
// su % acumulado (carátula) y el del EP cronológicamente anterior. Los EP
// creados a mano (sin carátula importada) no traen avanceAcumuladoPct y no
// aportan tramo — solo cuentan los EP importados desde Excel.
function calcularSegmentos(estadosPago: any[]) {
  const conPct = estadosPago
    .filter((ep) => ep.avanceAcumuladoPct != null)
    .slice()
    .sort((a, b) => new Date(a.fechaEp).getTime() - new Date(b.fechaEp).getTime());

  let anterior = 0;
  const segmentos = conPct.map((ep, i) => {
    const acumulado = Number(ep.avanceAcumuladoPct) * 100;
    const aporte = Math.max(0, acumulado - anterior);
    anterior = acumulado;
    return { ep, aporte, acumulado, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
  });

  return { segmentos, acumuladoFinal: anterior };
}

// Barra general de avance del subcontrato: un tramo de color por cada Estado
// de Pago, ancho proporcional a su aporte (% actual), que sumados dan el %
// acumulado del contrato completo.
function BarraAvanceGeneral({ estadosPago, compact = false }: { estadosPago: any[]; compact?: boolean }) {
  const { segmentos, acumuladoFinal } = calcularSegmentos(estadosPago);
  return (
    <div className={compact ? "w-28" : "w-full"}>
      <div className="relative h-2.5 bg-neutral-100 rounded-full overflow-hidden flex">
        {segmentos.length === 0 ? null : segmentos.map((s, i) => (
          <div
            key={i}
            title={`${s.ep.numeroEp}: +${s.aporte.toFixed(1)}% (acumulado ${s.acumulado.toFixed(1)}%)`}
            className={`h-full ${s.color}`}
            style={{ width: `${Math.min(100, s.aporte)}%` }}
          />
        ))}
      </div>
      <p className={`text-[10px] text-neutral-400 mt-1 ${compact ? "text-right" : ""}`}>
        {acumuladoFinal.toFixed(1)}% acumulado
        {!compact && ` · ${segmentos.length} EP${segmentos.length !== 1 ? "s" : ""} con avance`}
      </p>
    </div>
  );
}

export default function SubcontratosModule({ obraId, esSubTab = false, esCoordinadorAsignado = false }: { obraId?: number; esSubTab?: boolean; esCoordinadorAsignado?: boolean }) {
  const { usuario } = useAuth();
  const puedeVerCostos = esGerencia(usuario?.roles) || esJefatura(usuario?.roles);
  // Gerencia/jefatura o el coordinador asignado a esta obra pueden editar
  // precios y agregar ítems de presupuesto (el backend vuelve a validar esto,
  // este flag solo controla si se muestra la UI).
  const puedeEditarPartidas = puedeVerCostos || esCoordinadorAsignado;

  const [subcontratos, setSubcontratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creandoSubcontrato, setCreandoSubcontrato] = useState(false);
  const [creandoEpPara, setCreandoEpPara] = useState<number | null>(null);
  const [importandoEpPara, setImportandoEpPara] = useState<number | null>(null);
  const [cambiandoEstadoEp, setCambiandoEstadoEp] = useState<any>(null);
  const [detalleEp, setDetalleEp] = useState<{ sub: any; ep: any } | null>(null);
  const [expandedSub, setExpandedSub] = useState<number | null>(null);
  const [presupuestoDe, setPresupuestoDe] = useState<any>(null);

  async function cargar() {
    setLoading(true);
    try {
      const qs = obraId ? `?obraId=${obraId}` : "";
      const res = await apiFetch<any[]>(`/subcontratos${qs}`);
      setSubcontratos(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function eliminarSubcontrato(sub: any) {
    if (!confirm(`¿Eliminar el subcontrato de "${sub.empresa}" (${sub.especialidad})? Se eliminarán todos sus Estados de Pago. Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/subcontratos/${sub.id}`, { method: "DELETE" });
      showToast("Subcontrato eliminado", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
    }
  }

  async function eliminarEp(ep: any) {
    if (!confirm(`¿Eliminar el Estado de Pago ${ep.numeroEp}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/subcontratos/ep/${ep.id}`, { method: "DELETE" });
      showToast("Estado de Pago eliminado", "success");
      cargar();
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", "error");
    }
  }

  if (loading) return <div className="p-8"><CargandoTabla /></div>;

  const totalSubcontratos = subcontratos.reduce((s, c) => s + Number(c.montoContrato), 0);
  const montoPagado = subcontratos.reduce((sum, c) =>
    sum + c.estadosPago.filter((ep: any) => ep.estado === "PAGADO").reduce((s: number, ep: any) => s + Number(ep.montoEp), 0), 0);
  const montoCertificado = subcontratos.reduce((sum, c) =>
    sum + c.estadosPago.filter((ep: any) => ep.estado === "APROBADO" || ep.estado === "PAGADO").reduce((s: number, ep: any) => s + Number(ep.montoEp), 0), 0);
  const porAprobar = subcontratos.reduce((sum, c) =>
    sum + c.estadosPago.filter((ep: any) => ep.estado === "EN REVISIÓN" || ep.estado === "PENDIENTE").reduce((s: number, ep: any) => s + Number(ep.montoEp), 0), 0);

  return (
    <div className="space-y-6 py-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Subcontratos y Estados de Pago</h2>
          <p className="text-xs text-neutral-400 mt-0.5">{subcontratos.length} contrato{subcontratos.length !== 1 ? "s" : ""} registrado{subcontratos.length !== 1 ? "s" : ""}</p>
        </div>
        {esSubTab && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportandoEpPara(-1)}
              className="text-xs font-semibold bg-white hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-700 hover:text-orange-600 px-3 py-2 rounded-lg transition cursor-pointer"
            >
              Importar EP (Excel)
            </button>
            <button
              onClick={() => setCreandoSubcontrato(true)}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg shadow-sm cursor-pointer transition"
            >
              + Nuevo Subcontrato
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Monto Total Contratado" value={formatM(totalSubcontratos)} accent="text-neutral-800" />
        <KpiCard
          label="Monto Certificado"
          value={formatM(montoCertificado)}
          sub={totalSubcontratos > 0 ? `${((montoCertificado / totalSubcontratos) * 100).toFixed(1)}% del total` : undefined}
          accent="text-emerald-600"
        />
        <KpiCard label="Monto Pagado" value={formatM(montoPagado)} accent="text-emerald-700" />
        <KpiCard label="Por Aprobar/Pagar" value={formatM(porAprobar)} accent="text-orange-600" />
      </div>

      {/* Tabla expandible */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Detalle de Contratos</h3>
          <span className="text-[11px] text-neutral-400">Haz clic en un contrato para ver sus estados de pago</span>
        </div>

        {subcontratos.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400 italic">No hay subcontratos registrados.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {subcontratos.map((sub) => {
              const epActual = sub.estadosPago[0];
              const pagadoTotal = sub.estadosPago.filter((ep: any) => ep.estado === "PAGADO").reduce((s: number, ep: any) => s + Number(ep.montoEp), 0);
              const isExpanded = expandedSub === sub.id;

              return (
                <React.Fragment key={sub.id}>
                  {/* Fila principal */}
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedSub(isExpanded ? null : sub.id); }}
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-neutral-50 transition group cursor-pointer ${isExpanded ? "bg-orange-50/40" : ""}`}
                    onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                  >
                    {/* Chevron */}
                    <svg className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Especialidad + empresa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-neutral-800">{sub.especialidad}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{sub.empresa}</p>
                    </div>

                    {/* Columnas de datos */}
                    <div className="hidden md:flex items-center gap-8 shrink-0 text-right">
                      <div>
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase">Monto contrato</p>
                        <p className="text-sm font-bold text-neutral-800 mt-0.5">{formatM(Number(sub.montoContrato))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase" title="Suma del % de cada Estado de Pago importado">Avance</p>
                        <div className="mt-1"><BarraAvanceGeneral estadosPago={sub.estadosPago} compact /></div>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase">Pagado Total</p>
                        <p className="text-sm font-bold text-neutral-800 mt-0.5">{pagadoTotal > 0 ? formatM(pagadoTotal) : "—"}</p>
                      </div>
                      <div className="w-24">
                        {epActual ? <EpBadge estado={epActual.estado} /> : (
                          <span className="text-[10px] font-semibold text-neutral-400">Sin EP</span>
                        )}
                      </div>
                    </div>

                    {puedeVerCostos && (
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarSubcontrato(sub); }}
                        title="Eliminar subcontrato"
                        className="shrink-0 text-neutral-300 hover:text-red-500 transition cursor-pointer"
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    )}
                  </div>

                  {/* Panel expandido: historial de EPs */}
                  {isExpanded && (
                    <div className="bg-neutral-50/60 border-t border-neutral-100 px-5 py-4 pl-12">
                      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Avance general del contrato</p>
                        <BarraAvanceGeneral estadosPago={sub.estadosPago} />
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Historial de Estados de Pago</h4>
                        <div className="flex items-center gap-2">
                          {puedeEditarPartidas && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPresupuestoDe(sub); }}
                              className="text-xs font-semibold bg-white hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-700 hover:text-orange-600 px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Editar Presupuesto
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setImportandoEpPara(sub.id); }}
                            className="text-xs font-semibold bg-white hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-700 hover:text-orange-600 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Importar EP (Excel)
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCreandoEpPara(sub.id); }}
                            className="text-xs font-semibold bg-white hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-700 hover:text-orange-600 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            + Añadir EP
                          </button>
                        </div>
                      </div>

                      {sub.estadosPago.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic py-2">No hay estados de pago aún.</p>
                      ) : (
                        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                <th className="px-4 py-2.5">N° EP</th>
                                <th className="px-4 py-2.5">Fecha</th>
                                <th className="px-4 py-2.5 text-right">Monto</th>
                                <th className="px-4 py-2.5">Estado</th>
                                <th className="px-4 py-2.5"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                              {sub.estadosPago.map((ep: any) => (
                                <tr key={ep.id} className="hover:bg-neutral-50 transition">
                                  <td className="px-4 py-2.5 font-semibold text-neutral-700">{ep.numeroEp}</td>
                                  <td className="px-4 py-2.5 text-neutral-500">{new Date(ep.fechaEp).toLocaleDateString("es-CL")}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-700">{formatM(Number(ep.montoEp))}</td>
                                  <td className="px-4 py-2.5"><EpBadge estado={ep.estado} /></td>
                                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                    {puedeVerCostos && ep.totalPagar != null && (
                                      <button
                                        onClick={() => setDetalleEp({ sub, ep })}
                                        className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-800 hover:underline cursor-pointer mr-3"
                                      >
                                        Ver detalle
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setCambiandoEstadoEp(ep)}
                                      className="text-[10px] font-semibold text-orange-500 hover:underline cursor-pointer"
                                    >
                                      Cambiar estado
                                    </button>
                                    {puedeVerCostos && (
                                      <button
                                        onClick={() => eliminarEp(ep)}
                                        className="text-[10px] font-semibold text-neutral-400 hover:text-red-500 hover:underline cursor-pointer ml-3"
                                      >
                                        Eliminar
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Gráfico de avances */}
      {subcontratos.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Avance por Contrato</h3>
          <p className="text-[11px] text-neutral-400 mb-5">Cada tramo de color es el aporte de un Estado de Pago; sumados dan el % acumulado del contrato.</p>
          <div className="space-y-4">
            {subcontratos.map(sub => (
              <div key={sub.id} className="flex items-center gap-4">
                <div className="w-36 text-right text-xs font-medium text-neutral-600 truncate shrink-0">{sub.especialidad}</div>
                <div className="flex-1">
                  <BarraAvanceGeneral estadosPago={sub.estadosPago} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      {creandoSubcontrato && obraId && (
        <NuevoSubcontratoModal obraId={obraId} onClose={() => setCreandoSubcontrato(false)} onSaved={() => { setCreandoSubcontrato(false); cargar(); }} />
      )}
      {creandoEpPara && (
        <NuevoEpModal subcontratoId={creandoEpPara} onClose={() => setCreandoEpPara(null)} onSaved={() => { setCreandoEpPara(null); cargar(); }} />
      )}
      {importandoEpPara && obraId && (
        <ImportarEpModal obraId={obraId} onClose={() => setImportandoEpPara(null)} onSaved={() => { setImportandoEpPara(null); cargar(); }} />
      )}
      {cambiandoEstadoEp && (
        <CambiarEstadoEpModal ep={cambiandoEstadoEp} onClose={() => setCambiandoEstadoEp(null)} onSaved={() => { setCambiandoEstadoEp(null); cargar(); }} />
      )}
      {detalleEp && (
        <DetalleEpModal sub={detalleEp.sub} ep={detalleEp.ep} onClose={() => setDetalleEp(null)} />
      )}
      {presupuestoDe && (
        <PresupuestoModal sub={presupuestoDe} onClose={() => setPresupuestoDe(null)} onSaved={cargar} />
      )}
    </div>
  );
}

// ────────── Modales ──────────

const inputCls = "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-neutral-50 hover:bg-white transition";
const labelCls = "text-xs font-semibold text-neutral-500 block mb-1.5";
const btnPrimary = "px-4 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg cursor-pointer transition disabled:opacity-40";
const btnSecondary = "px-4 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg cursor-pointer transition";

function NuevoSubcontratoModal({ obraId, onClose, onSaved }: { obraId: number; onClose: () => void; onSaved: () => void }) {
  const [especialidad, setEspecialidad] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [montoContrato, setMontoContrato] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!especialidad || !empresa || !montoContrato) { showToast("Faltan campos requeridos", "error"); return; }
    setSaving(true);
    try {
      await apiFetch("/subcontratos", {
        method: "POST",
        body: JSON.stringify({ obraId, especialidad, empresa, montoContrato: Number(montoContrato) })
      });
      showToast("Subcontrato creado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo Subcontrato" onClose={onClose}>
      <div className="space-y-4">
        <div><label className={labelCls}>Especialidad *</label><input value={especialidad} onChange={e => setEspecialidad(e.target.value)} placeholder="Ej: Obras Civiles" className={inputCls} /></div>
        <div><label className={labelCls}>Empresa contratista *</label><input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ej: Constructora XYZ" className={inputCls} /></div>
        <div><label className={labelCls}>Monto del Contrato ($) *</label><input type="number" value={montoContrato} onChange={e => setMontoContrato(e.target.value)} placeholder="0" className={inputCls} /></div>
        <p className="text-[10px] text-neutral-400 leading-relaxed">
          El avance se calcula automáticamente desde los Estados de Pago (carátula del EP importado) una vez que el subcontrato tenga al menos uno.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function NuevoEpModal({ subcontratoId, onClose, onSaved }: { subcontratoId: number; onClose: () => void; onSaved: () => void }) {
  const [numeroEp, setNumeroEp] = useState("");
  const [fechaEp, setFechaEp] = useState("");
  const [montoEp, setMontoEp] = useState("");
  const [estado, setEstado] = useState("EN REVISIÓN");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!numeroEp || !fechaEp || !montoEp) { showToast("Faltan campos requeridos", "error"); return; }
    setSaving(true);
    try {
      await apiFetch(`/subcontratos/${subcontratoId}/ep`, { method: "POST", body: JSON.stringify({ numeroEp, fechaEp, montoEp: Number(montoEp), estado }) });
      showToast("Estado de Pago registrado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Registrar Estado de Pago" onClose={onClose}>
      <div className="space-y-4">
        <div><label className={labelCls}>N° de EP *</label><input value={numeroEp} onChange={e => setNumeroEp(e.target.value)} placeholder="Ej: EP-001" className={inputCls} /></div>
        <div><label className={labelCls}>Fecha del EP *</label><input type="date" value={fechaEp} onChange={e => setFechaEp(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Monto del EP ($) *</label><input type="number" value={montoEp} onChange={e => setMontoEp(e.target.value)} placeholder="0" className={inputCls} /></div>
        <div>
          <label className={labelCls}>Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
            <option value="EN REVISIÓN">EN REVISIÓN</option>
            <option value="PENDIENTE">PENDIENTE — Aprobado, esperando pago</option>
            <option value="APROBADO">APROBADO</option>
            <option value="PAGADO">PAGADO</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : "Guardar EP"}</button>
        </div>
      </div>
    </Modal>
  );
}

function CambiarEstadoEpModal({ ep, onClose, onSaved }: { ep: any; onClose: () => void; onSaved: () => void }) {
  const [estado, setEstado] = useState(ep.estado);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await apiFetch(`/subcontratos/ep/${ep.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      showToast("Estado actualizado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al actualizar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Actualizar EP: ${ep.numeroEp}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nuevo Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
            <option value="EN REVISIÓN">EN REVISIÓN</option>
            <option value="PENDIENTE">PENDIENTE — Aprobado, esperando pago</option>
            <option value="APROBADO">APROBADO</option>
            <option value="PAGADO">PAGADO</option>
          </select>
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          Al cambiar el estado a <strong>PAGADO</strong>, el monto se sumará al costo acumulado del proyecto.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Actualizando…" : "Actualizar"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ────────── Importar EP desde Excel ──────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImportarEpModal({ obraId, onClose, onSaved }: { obraId: number; onClose: () => void; onSaved: () => void }) {
  const [estado, setEstado] = useState("EN REVISIÓN");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function guardar() {
    if (!archivo) { showToast("Selecciona el archivo del Estado de Pago", "error"); return; }
    setSaving(true);
    try {
      const archivoBase64 = await fileToBase64(archivo);
      await apiFetch("/subcontratos/importar", {
        method: "POST",
        body: JSON.stringify({ obraId, archivoBase64, nombreArchivo: archivo.name, estado }),
      });
      showToast("Estado de Pago importado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al importar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Importar Estado de Pago (Excel)" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          Sube el Excel del EP (hojas "Carátula EEPP" y "Detalle EP"). Si la empresa y el N° de OC ya existen como
          subcontrato, este EP se agrega a su historial; si no, se crea el subcontrato con su presupuesto de partidas.
        </p>
        <div>
          <label className={labelCls}>Archivo del EP (.xls / .xlsx) *</label>
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className={`${inputCls} py-1.5`}
          />
        </div>
        <div>
          <label className={labelCls}>Estado inicial</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>
            <option value="EN REVISIÓN">EN REVISIÓN</option>
            <option value="PENDIENTE">PENDIENTE — Aprobado, esperando pago</option>
            <option value="APROBADO">APROBADO</option>
            <option value="PAGADO">PAGADO</option>
          </select>
        </div>
        <p className="text-[10px] text-neutral-400 leading-relaxed">
          El % ejecutado de la carátula (avance de este EP) es ponderado por el presupuesto de cada partida, no un promedio simple de los ítems.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={guardar} disabled={saving || !archivo} className={btnPrimary}>{saving ? "Importando…" : "Importar"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ────────── Detalle financiero + partidas de un EP (colapsable) ──────────

function Seccion({ titulo, sub, defaultOpen = true, children, accion }: { titulo: string; sub?: string; defaultOpen?: boolean; children: React.ReactNode; accion?: React.ReactNode }) {
  const [abierto, setAbierto] = useState(defaultOpen);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden mb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAbierto((v) => !v); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer"
      >
        <svg className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">{titulo}</span>
          {sub && <span className="text-[11px] text-neutral-400 ml-2">{sub}</span>}
        </div>
        {accion && <div onClick={(e) => e.stopPropagation()}>{accion}</div>}
      </div>
      {abierto && <div className="p-4">{children}</div>}
    </div>
  );
}

function barraAvance(pct: number) {
  return (
    <div className="h-1.5 w-16 rounded-full bg-neutral-100 overflow-hidden inline-block align-middle">
      <div className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-orange-400"}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// Agrupa la lista plana de partidas en capítulos (filas esCapitulo=true) con
// sus ítems hijos, calculando el total presupuestado y el avance ponderado
// (por presupuesto, no promedio simple) de cada capítulo para este EP.
function agruparPorCapitulo(partidas: any[], epId: number) {
  const grupos: { capitulo: any; items: any[] }[] = [];
  let actual: { capitulo: any; items: any[] } | null = null;
  for (const p of partidas) {
    if (p.esCapitulo) {
      actual = { capitulo: p, items: [] };
      grupos.push(actual);
    } else {
      if (!actual) { actual = { capitulo: null, items: [] }; grupos.push(actual); }
      actual.items.push(p);
    }
  }
  return grupos.map((g) => {
    const totalPresupuesto = g.items.reduce((s, p) => s + (p.total != null ? Number(p.total) : 0), 0);
    const montoAcumEP = g.items.reduce((s, p) => {
      const a = (p.avances ?? []).find((x: any) => x.estadoPagoId === epId);
      return s + (a ? Number(a.montoAcumulado) : 0);
    }, 0);
    const pctPonderado = totalPresupuesto > 0 ? (montoAcumEP / totalPresupuesto) * 100 : 0;
    return { ...g, totalPresupuesto, montoAcumEP, pctPonderado };
  });
}

function DetalleEpModal({ sub, ep, onClose }: { sub: any; ep: any; onClose: () => void }) {
  const partidas: any[] = sub.partidas ?? [];
  const grupos = agruparPorCapitulo(partidas, ep.id);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<number, boolean>>({});
  const toggleGrupo = (i: number) => setGruposAbiertos((s) => ({ ...s, [i]: !s[i] }));
  const todosAbiertos = grupos.length > 0 && grupos.every((_, i) => gruposAbiertos[i]);

  const filaClp = (label: string, valor: number | null | undefined, negativo = false) => (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-semibold ${negativo ? "text-red-600" : "text-neutral-800"}`}>
        {valor != null ? formatM(Number(valor)) : "—"}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl">
        {/* Header fijo: se mantiene visible (con la X) mientras se hace scroll del contenido */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 flex items-center justify-between px-6 py-4 rounded-t-xl">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-neutral-800 truncate">{ep.numeroEp} — {sub.especialidad}</h3>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{sub.empresa}{ep.emisor ? ` · Emisor: ${ep.emisor}` : ""}{ep.fechaEp ? ` · ${new Date(ep.fechaEp).toLocaleDateString("es-CL")}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none cursor-pointer shrink-0 ml-4">×</button>
        </div>

        <div className="p-6 pt-4">
        {/* Resumen rápido, siempre visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/80">Total a pagar</p>
            <p className="text-lg font-black text-orange-600 mt-0.5">{ep.totalPagar != null ? formatM(Number(ep.totalPagar)) : "—"}</p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">% Ejecutado acum.</p>
            <p className="text-lg font-black text-neutral-800 mt-0.5">{ep.avanceAcumuladoPct != null ? `${(Number(ep.avanceAcumuladoPct) * 100).toFixed(1)}%` : "—"}</p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Neto (sin IVA)</p>
            <p className="text-lg font-black text-neutral-800 mt-0.5">{ep.montoNeto != null ? formatM(Number(ep.montoNeto)) : "—"}</p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Subtotal bruto</p>
            <p className="text-lg font-black text-neutral-800 mt-0.5">{ep.subtotal != null ? formatM(Number(ep.subtotal)) : "—"}</p>
          </div>
        </div>

        {ep.archivoUrl && (
          <a href={ep.archivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:underline mb-4">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            Ver Excel original ↗
          </a>
        )}

        {/* Desglose financiero (colapsable) */}
        <Seccion titulo="Desglose financiero" defaultOpen>
          {filaClp("Subtotal (bruto del período)", ep.subtotal)}
          {filaClp("Dev. anticipo", ep.devAnticipo, true)}
          {filaClp("Retención", ep.retencion, true)}
          {filaClp("Neto (sin IVA)", ep.montoNeto)}
          {filaClp("IVA", ep.iva)}
          <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-neutral-200">
            <span className="font-bold text-neutral-700">Total a pagar</span>
            <span className="font-black text-orange-600">{ep.totalPagar != null ? formatM(Number(ep.totalPagar)) : "—"}</span>
          </div>
        </Seccion>

        {/* Presupuesto y avance por partida, agrupado por capítulo (colapsable) */}
        <Seccion
          titulo="Presupuesto y avance por partida"
          sub={`${grupos.length} capítulo${grupos.length !== 1 ? "s" : ""}`}
          defaultOpen
          accion={
            grupos.length > 0 ? (
              <button
                onClick={() => setGruposAbiertos(Object.fromEntries(grupos.map((_, i) => [i, !todosAbiertos])))}
                className="text-[10px] font-semibold text-neutral-500 hover:text-orange-600 cursor-pointer"
              >
                {todosAbiertos ? "Colapsar todo" : "Expandir todo"}
              </button>
            ) : undefined
          }
        >
          {grupos.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Este subcontrato no tiene detalle por partidas.</p>
          ) : (
            <div className="space-y-2">
              {grupos.map((g, i) => {
                const abierto = !!gruposAbiertos[i];
                return (
                  <div key={i} className="border border-neutral-200 rounded-lg overflow-hidden">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleGrupo(i)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleGrupo(i); }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white hover:bg-neutral-50 transition cursor-pointer"
                    >
                      <svg className={`w-3 h-3 text-neutral-400 shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                      <span className="text-xs font-bold text-neutral-700 flex-1 text-left truncate">
                        {g.capitulo ? `${g.capitulo.itemNumero ? g.capitulo.itemNumero + " " : ""}${g.capitulo.descripcion}` : "Sin capítulo"}
                      </span>
                      <span className="text-[10px] text-neutral-400 shrink-0">{g.items.length} ítem{g.items.length !== 1 ? "s" : ""}</span>
                      {barraAvance(g.pctPonderado)}
                      <span className="text-[11px] font-bold text-neutral-600 w-10 text-right shrink-0">{g.pctPonderado.toFixed(0)}%</span>
                      <span className="text-[11px] font-semibold text-neutral-500 w-20 text-right shrink-0">{formatM(g.totalPresupuesto)}</span>
                    </div>

                    {abierto && (
                      <table className="w-full text-left text-[11px] border-t border-neutral-100">
                        <thead>
                          <tr className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                            <th className="px-3 py-1.5">Descripción</th>
                            <th className="px-2 py-1.5 text-right">Un.</th>
                            <th className="px-2 py-1.5 text-right">Cant.</th>
                            <th className="px-2 py-1.5 text-right">Presupuesto</th>
                            <th className="px-3 py-1.5 text-right">Avance (ant. → EP → acum.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {g.items.map((p: any) => {
                            const a = (p.avances ?? []).find((x: any) => x.estadoPagoId === ep.id);
                            return (
                              <tr key={p.id} className="hover:bg-neutral-50">
                                <td className="px-3 py-1.5 text-neutral-700">{p.descripcion}</td>
                                <td className="px-2 py-1.5 text-right text-neutral-500">{p.unidad ?? "—"}</td>
                                <td className="px-2 py-1.5 text-right text-neutral-500">{p.cantidad ?? "—"}</td>
                                <td className="px-2 py-1.5 text-right text-neutral-600">{p.total != null ? formatM(Number(p.total)) : "—"}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                  {a ? (
                                    <span className="text-[10px]">
                                      <span className="text-neutral-400">{(Number(a.avanceAnteriorPct) * 100).toFixed(0)}%</span>
                                      <span className="text-neutral-300 mx-1">→</span>
                                      <span className="text-orange-600 font-semibold">+{(Number(a.avanceActualPct) * 100).toFixed(0)}%</span>
                                      <span className="text-neutral-300 mx-1">→</span>
                                      <span className={`font-bold ${Number(a.avanceAcumuladoPct) >= 1 ? "text-emerald-600" : "text-neutral-700"}`}>{(Number(a.avanceAcumuladoPct) * 100).toFixed(0)}%</span>
                                    </span>
                                  ) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>
        </div>
      </div>
    </div>
  );
}

// ────────── Editar presupuesto (precios/ítems, gerencia/jefatura o coordinador asignado) ──────────

function PresupuestoModal({ sub, onClose, onSaved }: { sub: any; onClose: () => void; onSaved: () => void }) {
  const [partidas, setPartidas] = useState<any[]>(sub.partidas ?? []);
  const [ediciones, setEdiciones] = useState<Record<number, { cantidad?: string; precioUnitario?: string }>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  function valorEditado(p: any, campo: "cantidad" | "precioUnitario") {
    const valorEdit = ediciones[p.id]?.[campo];
    if (valorEdit !== undefined) return valorEdit;
    return p[campo] != null ? String(Number(p[campo])) : "";
  }

  function setValor(id: number, campo: "cantidad" | "precioUnitario", valor: string) {
    setEdiciones((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }

  function hayCambios(p: any) {
    const edit = ediciones[p.id];
    if (!edit) return false;
    const cantidadCambio = edit.cantidad !== undefined && edit.cantidad !== "" && Number(edit.cantidad) !== (p.cantidad != null ? Number(p.cantidad) : null);
    const precioCambio = edit.precioUnitario !== undefined && edit.precioUnitario !== "" && Number(edit.precioUnitario) !== (p.precioUnitario != null ? Number(p.precioUnitario) : null);
    return cantidadCambio || precioCambio;
  }

  async function guardarFila(p: any) {
    const edit = ediciones[p.id];
    if (!edit) return;
    const body: any = {};
    if (edit.cantidad !== undefined && edit.cantidad !== "") body.cantidad = Number(edit.cantidad);
    if (edit.precioUnitario !== undefined && edit.precioUnitario !== "") body.precioUnitario = Number(edit.precioUnitario);
    if (Object.keys(body).length === 0) return;

    setGuardandoId(p.id);
    try {
      const actualizada = await apiFetch<any>(`/subcontratos/partidas/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setPartidas((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...actualizada } : x)));
      setEdiciones((prev) => {
        const { [p.id]: _omit, ...resto } = prev;
        return resto;
      });
      showToast("Ítem actualizado", "success");
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Error al guardar", "error");
    } finally {
      setGuardandoId(null);
    }
  }

  async function descargarExcel() {
    setDescargando(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/subcontratos/${sub.id}/exportar-excel`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("No se pudo generar el Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Presupuesto_${sub.empresa.replace(/[^a-zA-Z0-9]+/g, "_")}_${sub.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e.message || "Error al exportar", "error");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 flex items-center justify-between px-6 py-4 rounded-t-xl">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-neutral-800 truncate">Editar Presupuesto — {sub.especialidad}</h3>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{sub.empresa}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none cursor-pointer shrink-0 ml-4">×</button>
        </div>

        <div className="p-6 pt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Los cambios de precio o cantidad quedan registrados en la bitácora del proyecto con tu nombre y la fecha.
            </p>
            <button onClick={descargarExcel} disabled={descargando} className={`${btnSecondary} shrink-0`}>
              {descargando ? "Generando…" : "Exportar Excel"}
            </button>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2">Ítem</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-2 py-2 text-right">Un.</th>
                  <th className="px-2 py-2 text-right">Cantidad</th>
                  <th className="px-2 py-2 text-right">Precio Unit.</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {partidas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-neutral-400 italic">Sin ítems de presupuesto.</td></tr>
                )}
                {partidas.map((p) => p.esCapitulo ? (
                  <tr key={p.id} className="bg-neutral-50/80">
                    <td className="px-3 py-1.5 font-bold text-neutral-600" colSpan={7}>{p.itemNumero ? `${p.itemNumero} ` : ""}{p.descripcion}</td>
                  </tr>
                ) : (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-1.5 text-neutral-500">{p.itemNumero ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-700">{p.descripcion}</td>
                    <td className="px-2 py-1.5 text-right text-neutral-500">{p.unidad ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number" value={valorEditado(p, "cantidad")}
                        onChange={(e) => setValor(p.id, "cantidad", e.target.value)}
                        className="w-20 text-right border border-neutral-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number" value={valorEditado(p, "precioUnitario")}
                        onChange={(e) => setValor(p.id, "precioUnitario", e.target.value)}
                        className="w-24 text-right border border-neutral-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-600">{p.total != null ? formatM(Number(p.total)) : "—"}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {hayCambios(p) && (
                        <button
                          onClick={() => guardarFila(p)}
                          disabled={guardandoId === p.id}
                          className="text-[10px] font-semibold text-orange-600 hover:underline cursor-pointer disabled:opacity-40"
                        >
                          {guardandoId === p.id ? "…" : "Guardar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {agregando ? (
            <NuevoItemForm
              subcontratoId={sub.id}
              onCancel={() => setAgregando(false)}
              onAdded={(item) => { setPartidas((prev) => [...prev, item]); setAgregando(false); onSaved(); }}
            />
          ) : (
            <button onClick={() => setAgregando(true)} className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer">
              + Agregar ítem
            </button>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className={btnSecondary}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NuevoItemForm({ subcontratoId, onCancel, onAdded }: { subcontratoId: number; onCancel: () => void; onAdded: (item: any) => void }) {
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!descripcion.trim()) { showToast("La descripción es requerida", "error"); return; }
    setSaving(true);
    try {
      const item = await apiFetch<any>(`/subcontratos/${subcontratoId}/partidas`, {
        method: "POST",
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          unidad: unidad || undefined,
          cantidad: cantidad || undefined,
          precioUnitario: precioUnitario || undefined,
        }),
      });
      showToast("Ítem agregado", "success");
      onAdded(item);
    } catch (e: any) {
      showToast(e.message || "Error al agregar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-neutral-50/60">
      <div><label className={labelCls}>Descripción *</label><input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={labelCls}>Unidad</label><input value={unidad} onChange={(e) => setUnidad(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Cantidad</label><input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Precio Unit.</label><input type="number" value={precioUnitario} onChange={(e) => setPrecioUnitario(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={btnSecondary}>Cancelar</button>
        <button onClick={guardar} disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : "Agregar"}</button>
      </div>
    </div>
  );
}
