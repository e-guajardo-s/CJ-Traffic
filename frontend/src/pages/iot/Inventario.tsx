import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { useAuth } from "../../AuthContext";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import { disponibles, activas, type CategoriaInventario, type ItemInventario, type UnidadInventario } from "./inventarioTypes";
import type { Cruce } from "./types";

const inputClass =
  "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500";

const formatCLP = (n: number | null) =>
  n === null || n === undefined
    ? "sin precio"
    : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export default function Inventario({
  items,
  categorias,
  onChange,
}: {
  items: ItemInventario[];
  categorias: CategoriaInventario[];
  onChange: () => void;
}) {
  const { puede } = useAuth();
  const puedeEscribir = puede("iot", "ESCRITURA");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | "todas">("todas");
  const [creandoItem, setCreandoItem] = useState(false);
  const [editandoItem, setEditandoItem] = useState<ItemInventario | null>(null);
  const [eliminandoItem, setEliminandoItem] = useState<ItemInventario | null>(null);
  const [gestionandoCategorias, setGestionandoCategorias] = useState(false);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return items.filter((i) => {
      if (categoriaFiltro !== "todas" && i.categoriaId !== categoriaFiltro) return false;
      if (texto && !i.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [items, busqueda, categoriaFiltro]);

  const bajoStock = items.filter((i) => disponibles(i).length <= i.umbralMinimo);

  // Valor monetario del inventario: precio unitario × unidades activas (las dadas
  // de baja no cuentan). Se separa lo que está en bodega (disponible) de lo que ya
  // está en terreno.
  const valorTotal = items.reduce((s, i) => s + (i.precio ?? 0) * activas(i).length, 0);
  const valorDisponible = items.reduce((s, i) => s + (i.precio ?? 0) * disponibles(i).length, 0);
  const valorEnTerreno = valorTotal - valorDisponible;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Inventario de Desarrollo</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Cada equipo tiene unidades individuales con ID propio. Una unidad está disponible o asignada a un cruce específico.
            </p>
          </div>
          {puedeEscribir && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setGestionandoCategorias(true)}
                className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
              >
                Categorías
              </button>
              <button
                onClick={() => setCreandoItem(true)}
                className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
              >
                + Nuevo Item
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500">Valor total del inventario</p>
            <p className="text-xl font-bold text-neutral-800 mt-1">{formatCLP(valorTotal)}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500">En bodega (disponible)</p>
            <p className="text-xl font-bold text-sky-700 mt-1">{formatCLP(valorDisponible)}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500">En terreno</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{formatCLP(valorEnTerreno)}</p>
          </div>
        </div>

        {bajoStock.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 my-4">
            <p className="text-sm font-semibold text-amber-800">Stock disponible bajo en bodega</p>
            <p className="text-xs text-amber-700 mt-1">
              {bajoStock.map((i) => `${i.nombre} (${disponibles(i).length} disponible${disponibles(i).length === 1 ? "" : "s"})`).join(", ")}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 my-4 flex-wrap">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
          />
          <span className="text-xs font-semibold text-neutral-500 ml-2">Categoría:</span>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value === "todas" ? "todas" : Number(e.target.value))}
            className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="todas">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-neutral-400">
            {filtrados.length} de {items.length} items
          </span>
        </div>
      </div>

      {filtrados.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          puedeEscribir={puedeEscribir}
          onEditar={() => setEditandoItem(item)}
          onEliminar={() => setEliminandoItem(item)}
          onChange={onChange}
        />
      ))}

      {creandoItem && (
        <ItemModal
          titulo="Nuevo item de inventario"
          categorias={categorias}
          onClose={() => setCreandoItem(false)}
          onSaved={() => {
            setCreandoItem(false);
            onChange();
          }}
        />
      )}

      {editandoItem && (
        <ItemModal
          titulo={`Editar — ${editandoItem.nombre}`}
          item={editandoItem}
          categorias={categorias}
          onClose={() => setEditandoItem(null)}
          onSaved={() => {
            setEditandoItem(null);
            onChange();
          }}
        />
      )}

      {eliminandoItem && (
        <Modal title="Eliminar item" onClose={() => setEliminandoItem(null)}>
          <EliminarItem item={eliminandoItem} onClose={() => setEliminandoItem(null)} onDeleted={() => { setEliminandoItem(null); onChange(); }} />
        </Modal>
      )}

      {gestionandoCategorias && (
        <CategoriasModal categorias={categorias} onClose={() => setGestionandoCategorias(false)} onChange={onChange} />
      )}
    </div>
  );
}

function ItemCard({
  item,
  puedeEscribir,
  onEditar,
  onEliminar,
  onChange,
}: {
  item: ItemInventario;
  puedeEscribir: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onChange: () => void;
}) {
  const [creandoUnidad, setCreandoUnidad] = useState(false);
  const [asignando, setAsignando] = useState<UnidadInventario | null>(null);
  const [dandoBaja, setDandoBaja] = useState<UnidadInventario | null>(null);
  const [colapsado, setColapsado] = useState(false);
  const [ordenPor, setOrdenPor] = useState<"unidad" | "estado" | "cruce">("unidad");
  const [ordenDir, setOrdenDir] = useState<"asc" | "desc">("asc");
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [asignandoMasivo, setAsignandoMasivo] = useState(false);
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);
  const disp = disponibles(item);
  const deBaja = item.unidades.filter((u) => u.dadaDeBaja).length;

  function toggleSel(id: number) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const limpiarSel = () => setSeleccion(new Set());
  const unidadesSeleccionadas = item.unidades.filter((u) => seleccion.has(u.id));

  // Rango de estado para ordenar: disponible < en bodega < en terreno < dada de baja.
  const rangoEstado = (u: UnidadInventario) => (u.dadaDeBaja ? 3 : u.cruce ? 2 : u.ubicacionFisica ? 1 : 0);

  const unidadesOrdenadas = [...item.unidades].sort((a, b) => {
    let cmp = 0;
    if (ordenPor === "unidad") cmp = a.codigoUnidad.localeCompare(b.codigoUnidad, undefined, { numeric: true });
    else if (ordenPor === "estado") cmp = rangoEstado(a) - rangoEstado(b);
    else cmp = (a.cruce?.ubicacion ?? "").localeCompare(b.cruce?.ubicacion ?? "", undefined, { numeric: true });
    return ordenDir === "asc" ? cmp : -cmp;
  });

  function ordenar(col: "unidad" | "estado" | "cruce") {
    if (ordenPor === col) setOrdenDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdenPor(col);
      setOrdenDir("asc");
    }
  }

  const flecha = (col: "unidad" | "estado" | "cruce") => (ordenPor === col ? (ordenDir === "asc" ? " ▲" : " ▼") : "");

  const todosSeleccionados = unidadesOrdenadas.length > 0 && unidadesOrdenadas.every((u) => seleccion.has(u.id));
  const toggleTodos = () => setSeleccion(todosSeleccionados ? new Set() : new Set(unidadesOrdenadas.map((u) => u.id)));

  async function retirar(unidad: UnidadInventario) {
    try {
      await apiFetch(`/iot/inventario/unidades/${unidad.id}/asignacion`, {
        method: "PATCH",
        body: JSON.stringify({ cruceId: null }),
      });
      showToast(`Unidad ${unidad.codigoUnidad} vuelve a disponible.`, "success");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo retirar", "error");
    }
  }

  async function reactivar(unidad: UnidadInventario) {
    try {
      await apiFetch(`/iot/inventario/unidades/${unidad.id}/baja`, {
        method: "PATCH",
        body: JSON.stringify({ dadaDeBaja: false }),
      });
      showToast(`Unidad ${unidad.codigoUnidad} reactivada.`, "success");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo reactivar", "error");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setColapsado((c) => !c)}
              className="text-neutral-400 hover:text-neutral-700 text-sm w-5 shrink-0"
              title={colapsado ? "Expandir" : "Colapsar"}
            >
              {colapsado ? "▸" : "▾"}
            </button>
            <p className="text-sm font-bold text-neutral-800">
              {item.nombre}
              {item.sku && <span className="ml-2 text-[11px] font-mono font-semibold text-neutral-400">SKU {item.sku}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2 ml-7">
            <span className="text-sm font-bold text-neutral-800 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-lg">
              {formatCLP(item.precio)}
            </span>
            <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
              {item.categoria.nombre}
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                disp.length <= item.umbralMinimo
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-neutral-600 bg-neutral-50 border-neutral-200"
              }`}
            >
              {disp.length} disponible{disp.length === 1 ? "" : "s"} / {activas(item).length} total
            </span>
            {deBaja > 0 && (
              <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                {deBaja} de baja
              </span>
            )}
            <span className="text-[11px] text-neutral-400">umbral mín. {item.umbralMinimo}</span>
          </div>
        </div>
        {puedeEscribir && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEditar} className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md">
              Editar item
            </button>
            <button onClick={onEliminar} className="text-[11px] font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded-md">
              Eliminar item
            </button>
          </div>
        )}
      </div>

      {!colapsado && puedeEscribir && seleccion.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-4 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-neutral-600">{seleccion.size} seleccionada{seleccion.size === 1 ? "" : "s"}</span>
          <button onClick={() => setAsignandoMasivo(true)} className="text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-md">
            Asignar
          </button>
          <button onClick={() => setEliminandoMasivo(true)} className="text-[11px] font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded-md">
            Eliminar
          </button>
          <button onClick={limpiarSel} className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 ml-auto">
            Limpiar selección
          </button>
        </div>
      )}

      {!colapsado && (
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-200">
              {puedeEscribir && (
                <th className="py-2 pr-3 w-8">
                  <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} className="accent-orange-500" title="Seleccionar todas" />
                </th>
              )}
              <th className="py-2 pr-4">
                <button onClick={() => ordenar("unidad")} className="uppercase tracking-wider hover:text-neutral-600">
                  Unidad{flecha("unidad")}
                </button>
              </th>
              <th className="py-2 pr-4">
                <button onClick={() => ordenar("estado")} className="uppercase tracking-wider hover:text-neutral-600">
                  Estado{flecha("estado")}
                </button>
              </th>
              <th className="py-2 pr-4">
                <button onClick={() => ordenar("cruce")} className="uppercase tracking-wider hover:text-neutral-600">
                  Cruce asociado{flecha("cruce")}
                </button>
              </th>
              {puedeEscribir && <th className="py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {unidadesOrdenadas.map((u) => (
              <tr key={u.id} className={seleccion.has(u.id) ? "bg-orange-50/50" : ""}>
                {puedeEscribir && (
                  <td className="py-2 pr-3">
                    <input type="checkbox" checked={seleccion.has(u.id)} onChange={() => toggleSel(u.id)} className="accent-orange-500" />
                  </td>
                )}
                <td className="py-2 pr-4 font-mono font-semibold text-neutral-700">#{u.codigoUnidad}</td>
                <td className="py-2 pr-4">
                  {u.dadaDeBaja ? (
                    <span
                      className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700"
                      title={u.notaBaja ?? undefined}
                    >
                      Dada de baja
                    </span>
                  ) : u.cruce ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">En terreno</span>
                  ) : u.ubicacionFisica ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-sky-100 text-sky-700">
                      En bodega — {u.ubicacionFisica}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">Disponible</span>
                  )}
                  {u.dadaDeBaja && u.notaBaja && (
                    <span className="block text-[11px] text-neutral-400 mt-1 italic">{u.notaBaja}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-neutral-600">{u.cruce?.ubicacion ?? "—"}</td>
                {puedeEscribir && (
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {u.dadaDeBaja ? (
                        <button onClick={() => reactivar(u)} className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md">
                          Reactivar
                        </button>
                      ) : (
                        <>
                          {u.cruce ? (
                            <button onClick={() => retirar(u)} className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md">
                              Retirar del cruce
                            </button>
                          ) : (
                            <button onClick={() => setAsignando(u)} className="text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-md">
                              Asignar
                            </button>
                          )}
                          <button onClick={() => setDandoBaja(u)} className="text-[11px] font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded-md">
                            Dar de baja
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {item.unidades.length === 0 && <p className="text-xs text-neutral-400 py-2">Sin unidades registradas.</p>}
      </div>
      )}

      {!colapsado && puedeEscribir && (
        <button
          onClick={() => setCreandoUnidad(true)}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 mt-3"
        >
          + Agregar unidades
        </button>
      )}

      {creandoUnidad && (
        <AgregarUnidadesModal item={item} onClose={() => setCreandoUnidad(false)} onCreated={() => { setCreandoUnidad(false); onChange(); }} />
      )}

      {asignando && (
        <AsignarModal unidad={asignando} onClose={() => setAsignando(null)} onAsignada={() => { setAsignando(null); onChange(); }} />
      )}

      {dandoBaja && (
        <DarDeBajaModal unidad={dandoBaja} onClose={() => setDandoBaja(null)} onDone={() => { setDandoBaja(null); onChange(); }} />
      )}

      {asignandoMasivo && (
        <AsignarMasivoModal
          unidades={unidadesSeleccionadas}
          onClose={() => setAsignandoMasivo(false)}
          onDone={() => { setAsignandoMasivo(false); limpiarSel(); onChange(); }}
        />
      )}

      {eliminandoMasivo && (
        <EliminarUnidadesModal
          unidades={unidadesSeleccionadas}
          onClose={() => setEliminandoMasivo(false)}
          onDone={() => { setEliminandoMasivo(false); limpiarSel(); onChange(); }}
        />
      )}
    </div>
  );
}

function AsignarMasivoModal({ unidades, onClose, onDone }: { unidades: UnidadInventario[]; onClose: () => void; onDone: () => void }) {
  const [modo, setModo] = useState<"cruce" | "fisica">("fisica");
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [cruceId, setCruceId] = useState<number | "">("");
  const [ubicacionFisica, setUbicacionFisica] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = unidades.map((u) => u.id);
  const deBaja = unidades.filter((u) => u.dadaDeBaja).length;

  useEffect(() => {
    apiFetch<Cruce[]>("/iot/gateways")
      .then((data) => {
        const conMantencion = data.filter((c) => c.gateway?.enMantencion);
        setCruces(conMantencion);
        if (conMantencion[0]) setCruceId(conMantencion[0].id);
      })
      .catch(() => setError("No se pudo cargar la lista de cruces"));
  }, []);

  async function guardar() {
    setError(null);
    if (modo === "cruce" && !cruceId) {
      setError("Selecciona un cruce.");
      return;
    }
    if (modo === "fisica" && !ubicacionFisica.trim()) {
      setError("Escribe la ubicación física.");
      return;
    }
    setSaving(true);
    try {
      const body = modo === "cruce" ? { ids, cruceId } : { ids, ubicacionFisica: ubicacionFisica.trim() };
      const r = await apiFetch<{ actualizadas: number }>("/iot/inventario/unidades/asignacion-masiva", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      showToast(`${r.actualizadas} unidad${r.actualizadas === 1 ? "" : "es"} ${modo === "cruce" ? "asignada(s) al cruce" : "ubicada(s)"}.`, "success");
      onDone();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo asignar";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (activo: boolean) =>
    `flex-1 text-xs font-semibold px-3 py-2 rounded-lg border ${
      activo ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
    }`;

  return (
    <Modal title={`Asignar ${ids.length} unidad${ids.length === 1 ? "" : "es"}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setModo("cruce")} className={tabClass(modo === "cruce")}>
            A un cruce
          </button>
          <button type="button" onClick={() => setModo("fisica")} className={tabClass(modo === "fisica")}>
            Ubicación física
          </button>
        </div>

        {modo === "cruce" ? (
          !cruces ? (
            <p className="text-sm text-neutral-500">Cargando cruces…</p>
          ) : cruces.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay cruces en mantención disponibles.</p>
          ) : (
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">Cruce destino</label>
              <select value={cruceId} onChange={(e) => setCruceId(Number(e.target.value))} className={inputClass}>
                {cruces.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.ubicacion}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1.5">Un cruce puede tener varias unidades (ej. varios relés).</p>
            </div>
          )
        ) : (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Ubicación física (bodega, estante…)</label>
            <input value={ubicacionFisica} onChange={(e) => setUbicacionFisica(e.target.value)} placeholder="Estante A3" className={inputClass} autoFocus />
          </div>
        )}

        {deBaja > 0 && (
          <p className="text-[11px] text-amber-700">{deBaja} de las seleccionadas están dadas de baja y se omitirán.</p>
        )}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving || (modo === "cruce" && !cruces?.length)}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Asignando…" : "Asignar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EliminarUnidadesModal({ unidades, onClose, onDone }: { unidades: UnidadInventario[]; onClose: () => void; onDone: () => void }) {
  const [confirmado, setConfirmado] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ids = unidades.map((u) => u.id);
  const enTerreno = unidades.filter((u) => u.cruce);

  async function eliminar() {
    setDeleting(true);
    try {
      const r = await apiFetch<{ eliminadas: number }>("/iot/inventario/unidades/eliminar-masivo", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      showToast(`${r.eliminadas} unidad${r.eliminadas === 1 ? "" : "es"} eliminada${r.eliminadas === 1 ? "" : "s"}.`, "success");
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudieron eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (!confirmado) {
    return (
      <Modal title={`Eliminar ${ids.length} unidad${ids.length === 1 ? "" : "es"}`} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            ¿Eliminar <span className="font-semibold">{ids.length}</span> unidad{ids.length === 1 ? "" : "es"} del inventario?
          </p>
          {enTerreno.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ {enTerreno.length} está{enTerreno.length === 1 ? "" : "n"} en terreno ({enTerreno.map((u) => u.cruce!.codigo).join(", ")}); el cruce quedará libre.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
              Cancelar
            </button>
            <button onClick={() => setConfirmado(true)} className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg">
              Continuar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Confirmar eliminación" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          Confirma por segunda vez: se eliminarán <span className="font-semibold">{ids.length}</span> unidad{ids.length === 1 ? "" : "es"} de forma <span className="font-semibold">permanente</span>.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setConfirmado(false)} disabled={deleting} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Volver
          </button>
          <button onClick={eliminar} disabled={deleting} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {deleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AgregarUnidadesModal({ item, onClose, onCreated }: { item: ItemInventario; onClose: () => void; onCreated: () => void }) {
  const [cantidad, setCantidad] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Próximo número: mayor código numérico existente + 1 (para la vista previa).
  const maxNum = item.unidades.reduce((m, u) => {
    const n = parseInt(u.codigoUnidad, 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const n = Math.trunc(Number(cantidad));
  const cantidadValida = Number.isFinite(n) && n >= 1;
  const preview = cantidadValida ? (n === 1 ? `#${maxNum + 1}` : `#${maxNum + 1} … #${maxNum + n}`) : "—";

  async function guardar() {
    if (!cantidadValida) {
      setError("Ingresa una cantidad válida (≥ 1).");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/iot/inventario/items/${item.id}/unidades`, {
        method: "POST",
        body: JSON.stringify({ cantidad: n }),
      });
      showToast(`${n} unidad${n === 1 ? "" : "es"} agregada${n === 1 ? "" : "s"}.`, "success");
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudieron crear las unidades";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Agregar unidades — ${item.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">¿Cuántas unidades?</label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className={inputClass}
            autoFocus
          />
          <p className="text-[11px] text-neutral-400 mt-1.5">
            Se numeran solas de 1 en 1. Se crearán: <span className="font-mono font-semibold text-neutral-600">{preview}</span>
          </p>
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Creando…" : "Agregar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DarDeBajaModal({ unidad, onClose, onDone }: { unidad: UnidadInventario; onClose: () => void; onDone: () => void }) {
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nota.trim()) {
      setError("La nota justificatoria es obligatoria.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/iot/inventario/unidades/${unidad.id}/baja`, {
        method: "PATCH",
        body: JSON.stringify({ dadaDeBaja: true, nota: nota.trim() }),
      });
      showToast(`Unidad #${unidad.codigoUnidad} dada de baja.`, "success");
      onDone();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo dar de baja";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Dar de baja unidad #${unidad.codigoUnidad}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          La unidad dejará de contar como stock y se liberará de cualquier cruce o ubicación. Queda el registro con tu justificación.
        </p>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Motivo / nota (obligatorio)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Ej. Se quemó la fuente, sin reparación posible."
            className={inputClass}
            autoFocus
          />
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Dando de baja…" : "Dar de baja"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AsignarModal({ unidad, onClose, onAsignada }: { unidad: UnidadInventario; onClose: () => void; onAsignada: () => void }) {
  const [modo, setModo] = useState<"cruce" | "fisica">("cruce");
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [cruceId, setCruceId] = useState<number | "">("");
  const [ubicacionFisica, setUbicacionFisica] = useState(unidad.ubicacionFisica ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Cruce[]>("/iot/gateways")
      .then((data) => {
        // Solo cruces en mantención son destino válido: los "sin mantención" no
        // pertenecen a la empresa (aunque conserven su ID para una reasignación futura).
        const conMantencion = data.filter((c) => c.gateway?.enMantencion);
        setCruces(conMantencion);
        if (conMantencion[0]) setCruceId(conMantencion[0].id);
      })
      .catch(() => setError("No se pudo cargar la lista de cruces"));
  }, []);

  async function guardar() {
    setError(null);
    if (modo === "cruce" && !cruceId) {
      setError("Selecciona un cruce.");
      return;
    }
    if (modo === "fisica" && !ubicacionFisica.trim()) {
      setError("Escribe la ubicación física.");
      return;
    }
    setSaving(true);
    try {
      const body = modo === "cruce" ? { cruceId } : { ubicacionFisica: ubicacionFisica.trim() };
      await apiFetch(`/iot/inventario/unidades/${unidad.id}/asignacion`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      showToast(`Unidad #${unidad.codigoUnidad} ${modo === "cruce" ? "asignada al cruce" : "ubicada en bodega"}.`, "success");
      onAsignada();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo asignar";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (activo: boolean) =>
    `flex-1 text-xs font-semibold px-3 py-2 rounded-lg border ${
      activo ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
    }`;

  return (
    <Modal title={`Asignar unidad #${unidad.codigoUnidad}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setModo("cruce")} className={tabClass(modo === "cruce")}>
            A un cruce
          </button>
          <button type="button" onClick={() => setModo("fisica")} className={tabClass(modo === "fisica")}>
            Ubicación física
          </button>
        </div>

        {modo === "cruce" ? (
          !cruces ? (
            <p className="text-sm text-neutral-500">Cargando cruces…</p>
          ) : cruces.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay cruces en mantención disponibles.</p>
          ) : (
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">Cruce destino</label>
              <select value={cruceId} onChange={(e) => setCruceId(Number(e.target.value))} className={inputClass}>
                {cruces.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.ubicacion}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1.5">
                Si ese cruce ya tenía otra unidad asignada, quedará automáticamente disponible.
              </p>
            </div>
          )
        ) : (
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Ubicación física (bodega, estante…)</label>
            <input
              value={ubicacionFisica}
              onChange={(e) => setUbicacionFisica(e.target.value)}
              placeholder="Estante A3"
              className={inputClass}
            />
          </div>
        )}

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving || (modo === "cruce" && !cruces?.length)}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Asignando…" : "Asignar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EliminarItem({ item, onClose, onDeleted }: { item: ItemInventario; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const totalUnidades = item.unidades.length;
  const enTerreno = item.unidades.filter((u) => u.cruce);

  async function eliminar() {
    setDeleting(true);
    try {
      await apiFetch(`/iot/inventario/items/${item.id}`, { method: "DELETE" });
      showToast(`${item.nombre} eliminado.`, "success");
      onDeleted();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (!confirmado) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          ¿Eliminar <span className="font-semibold">{item.nombre}</span> del inventario?
        </p>
        {totalUnidades > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
            <p>
              Se eliminarán también sus <span className="font-semibold">{totalUnidades}</span> unidad
              {totalUnidades === 1 ? "" : "es"} registrada{totalUnidades === 1 ? "" : "s"}.
            </p>
            {enTerreno.length > 0 && (
              <p className="font-semibold">
                ⚠ {enTerreno.length} está{enTerreno.length === 1 ? "" : "n"} asignada
                {enTerreno.length === 1 ? "" : "s"} a un cruce en terreno ({enTerreno.map((u) => u.cruce!.codigo).join(", ")}).
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={() => setConfirmado(true)} className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Confirma por segunda vez: esta acción <span className="font-semibold">no se puede deshacer</span>. Se eliminará{" "}
        <span className="font-semibold">{item.nombre}</span>
        {totalUnidades > 0 ? ` y sus ${totalUnidades} unidad${totalUnidades === 1 ? "" : "es"}` : ""}.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={() => setConfirmado(false)} disabled={deleting} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
          Volver
        </button>
        <button onClick={eliminar} disabled={deleting} className="text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
          {deleting ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </div>
  );
}

function ItemModal({
  titulo,
  item,
  categorias,
  onClose,
  onSaved,
}: {
  titulo: string;
  item?: ItemInventario;
  categorias: CategoriaInventario[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [categoriaId, setCategoriaId] = useState<number | "" | "nueva">(item?.categoriaId ?? categorias[0]?.id ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [precio, setPrecio] = useState(item?.precio != null ? String(item.precio) : "");
  const [umbralMinimo, setUmbralMinimo] = useState(String(item?.umbralMinimo ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!nombre || !categoriaId) {
      setError("Nombre y categoría son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      // Resolver la categoría: si se eligió "Ingrese la categoría…", se reutiliza
      // una existente con el mismo nombre o se crea una nueva.
      let catId = categoriaId;
      if (categoriaId === "nueva") {
        const nombreCat = nuevaCategoria.trim();
        if (!nombreCat) {
          setError("Escribe el nombre de la categoría.");
          setSaving(false);
          return;
        }
        const existente = categorias.find((c) => c.nombre.toLowerCase() === nombreCat.toLowerCase());
        if (existente) {
          catId = existente.id;
        } else {
          const creada = await apiFetch<CategoriaInventario>("/iot/inventario/categorias", {
            method: "POST",
            body: JSON.stringify({ nombre: nombreCat }),
          });
          catId = creada.id;
        }
      }
      const body = JSON.stringify({
        nombre,
        sku: sku.trim() || null,
        categoriaId: catId,
        precio: precio.trim() === "" ? null : Number(precio),
        umbralMinimo: Number(umbralMinimo) || 0,
      });
      if (item) {
        await apiFetch(`/iot/inventario/items/${item.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/iot/inventario/items", { method: "POST", body });
      }
      showToast(`${nombre} guardado.`, "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Nombre / modelo</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Teltonika TRB256" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} placeholder="TRB256-4G" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value === "nueva" ? "nueva" : Number(e.target.value))}
              className={inputClass}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
              <option value="nueva">Ingrese la categoría…</option>
            </select>
            {categoriaId === "nueva" && (
              <input
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                placeholder="Nombre de la categoría"
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Precio unitario (CLP)</label>
            <input type="number" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} className={inputClass} placeholder="85000" />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Umbral mínimo (unidades disponibles)</label>
          <input type="number" min={0} value={umbralMinimo} onChange={(e) => setUmbralMinimo(e.target.value)} className={inputClass} />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CategoriasModal({ categorias, onClose, onChange }: { categorias: CategoriaInventario[]; onClose: () => void; onChange: () => void }) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [saving, setSaving] = useState(false);

  async function crear() {
    if (!nuevoNombre) return;
    setSaving(true);
    try {
      await apiFetch("/iot/inventario/categorias", { method: "POST", body: JSON.stringify({ nombre: nuevoNombre }) });
      setNuevoNombre("");
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo crear la categoría", "error");
    } finally {
      setSaving(false);
    }
  }

  async function renombrar(id: number) {
    if (!editandoNombre) return;
    try {
      await apiFetch(`/iot/inventario/categorias/${id}`, { method: "PATCH", body: JSON.stringify({ nombre: editandoNombre }) });
      setEditandoId(null);
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo renombrar", "error");
    }
  }

  async function eliminar(id: number) {
    try {
      await apiFetch(`/iot/inventario/categorias/${id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo eliminar", "error");
    }
  }

  return (
    <Modal title="Gestionar categorías" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          {categorias.map((c) =>
            editandoId === c.id ? (
              <div key={c.id} className="flex items-center gap-2">
                <input value={editandoNombre} onChange={(e) => setEditandoNombre(e.target.value)} className={inputClass} />
                <button onClick={() => renombrar(c.id)} className="text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-2 rounded-md">
                  Guardar
                </button>
              </div>
            ) : (
              <div key={c.id} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                <span className="text-sm text-neutral-700">{c.nombre}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditandoId(c.id);
                      setEditandoNombre(c.nombre);
                    }}
                    className="text-[11px] font-bold text-neutral-500 hover:text-neutral-700"
                  >
                    Renombrar
                  </button>
                  <button onClick={() => eliminar(c.id)} className="text-[11px] font-bold text-red-500 hover:text-red-700">
                    Eliminar
                  </button>
                </div>
              </div>
            ),
          )}
          {categorias.length === 0 && <p className="text-xs text-neutral-400">Sin categorías aún.</p>}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nueva categoría…"
            className={inputClass}
          />
          <button onClick={crear} disabled={saving} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg whitespace-nowrap">
            + Crear
          </button>
        </div>
      </div>
    </Modal>
  );
}
