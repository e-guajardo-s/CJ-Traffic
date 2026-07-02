import { useState } from "react";
import { apiFetch } from "../../api";
import { showToast } from "../../components/toast";
import type { ComponenteStack, Proyecto } from "./types";

interface ConstructorStackProps {
  proyecto: Proyecto;
  puedeEscribir: boolean;
  onChange: () => void;
}

export function ConstructorStack({ proyecto, puedeEscribir, onChange }: ConstructorStackProps) {
  const componentes: ComponenteStack[] = proyecto.componentesStack ?? [];

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevosDetalles, setNuevosDetalles] = useState("");
  const [capaSeleccionada, setCapaSeleccionada] = useState<'HARDWARE' | 'RED' | 'PROCESAMIENTO' | 'VISUALIZACION'>('HARDWARE');
  const [agregando, setAgregando] = useState(false);
  const [saving, setSaving] = useState(false);

  const capas = [
    { key: 'HARDWARE', titulo: '1. Captura / Terreno', color: 'border-l-blue-500 hover:border-blue-400' },
    { key: 'RED', titulo: '2. Conectividad / Red', color: 'border-l-emerald-500 hover:border-emerald-400' },
    { key: 'PROCESAMIENTO', titulo: '3. Procesamiento / Cloud', color: 'border-l-purple-500 hover:border-purple-400' },
    { key: 'VISUALIZACION', titulo: '4. Aplicación / Visualización', color: 'border-l-orange-500 hover:border-orange-400' },
  ];

  async function agregarBloque() {
    if (!nuevoNombre.trim()) {
      showToast("El nombre del componente es requerido.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/proyectos/${proyecto.id}/stack`, {
        method: "POST",
        body: JSON.stringify({
          capa: capaSeleccionada,
          nombre: nuevoNombre.trim(),
          detalles: nuevosDetalles.trim() || null
        })
      });
      showToast("Bloque agregado con éxito.", "success");
      setNuevoNombre("");
      setNuevosDetalles("");
      setAgregando(false);
      onChange();
    } catch (e: any) {
      showToast(e.message || "Error al agregar bloque.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarBloque(id: number, nombre: string) {
    if (!confirm(`¿Eliminar el bloque "${nombre}" del stack?`)) return;
    try {
      await apiFetch(`/proyectos/stack/${id}`, { method: "DELETE" });
      showToast("Bloque eliminado.", "success");
      onChange();
    } catch (e: any) {
      showToast(e.message || "No se pudo eliminar el bloque.", "error");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-neutral-800">Arquitectura del Stack Tecnológico</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Define el flujo de datos del proyecto desde los dispositivos en terreno hasta la visualización en la intranet.
          </p>
        </div>
        {puedeEscribir && (
          <button 
            onClick={() => setAgregando(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            + Agregar Bloque
          </button>
        )}
      </div>

      {/* Flujo Visual Horizontal Interactivo */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
        {capas.map((capa, index) => {
          const bloquesCapa = componentes.filter(c => c.capa === capa.key);
          
          return (
            <div key={capa.key} className="relative flex flex-col">
              {/* Título de la Capa */}
              <div className="mb-3 px-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                  {capa.titulo}
                </span>
              </div>

              {/* Contenedor de Bloques */}
              <div className="space-y-3 flex-1 border border-neutral-100 bg-neutral-50/30 rounded-xl p-3 min-h-[160px] flex flex-col justify-start">
                {bloquesCapa.map((b) => (
                  <div 
                    key={b.id} 
                    className={`group/item border rounded-xl p-3.5 bg-white shadow-sm hover:shadow-md transition-all border-l-4 relative ${capa.color}`}
                  >
                    {puedeEscribir && (
                      <button
                        onClick={() => eliminarBloque(b.id, b.nombre)}
                        className="absolute top-3.5 right-3.5 p-0.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        title="Eliminar bloque"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                    
                    <p className="text-xs font-bold text-neutral-800 leading-tight pr-5">{b.nombre}</p>
                    {b.detalles && <p className="text-[10px] text-neutral-500 mt-1 leading-normal">{b.detalles}</p>}
                  </div>
                ))}
                {bloquesCapa.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <p className="text-[11px] text-neutral-400 italic">Sin definir</p>
                  </div>
                )}
              </div>

              {/* Flecha indicadora de flujo entre columnas (Solo en pantallas grandes) */}
              {index < 3 && (
                <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 text-neutral-300 pointer-events-none">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Formulario rápido flotante para agregar bloques */}
      {agregando && (
        <div className="mt-6 p-5 border border-neutral-200 bg-neutral-50 rounded-2xl space-y-4 max-w-lg transition-all">
          <p className="text-xs font-bold text-neutral-700 uppercase tracking-widest">Nuevo Elemento Tecnológico</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Capa / Nivel</label>
              <select 
                value={capaSeleccionada} 
                onChange={(e) => setCapaSeleccionada(e.target.value as any)}
                className="w-full bg-white border border-neutral-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="HARDWARE">Terreno / Equipos</option>
                <option value="RED">Conectividad / Red</option>
                <option value="PROCESAMIENTO">Procesamiento / Broker</option>
                <option value="VISUALIZACION">Visualización / App</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Nombre del Componente</label>
              <input 
                type="text" 
                placeholder="Ej: Gateway Teltonika TRB256" 
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Detalles Operativos (Opcional)</label>
            <input 
              type="text" 
              placeholder="Ej: Transmisión vía MQTT cada 5 segundos" 
              value={nuevosDetalles}
              onChange={(e) => setNuevosDetalles(e.target.value)}
              className="w-full bg-white border border-neutral-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200/50">
            <button 
              onClick={() => setAgregando(false)} 
              disabled={saving}
              className="text-xs font-semibold bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-600 px-3 py-2 rounded-lg"
            >
              Cancelar
            </button>
            <button 
              onClick={agregarBloque} 
              disabled={saving}
              className="text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-sm"
            >
              {saving ? "Guardando..." : "Guardar Bloque"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
