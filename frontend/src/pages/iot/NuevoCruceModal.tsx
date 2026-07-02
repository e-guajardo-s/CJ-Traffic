import { useState } from "react";
import { apiFetch, ApiError } from "../../api";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import GatewayCampos, { gatewayCamposIniciales, type GatewayCamposValue } from "./GatewayCampos";

export default function NuevoCruceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [controlador, setControlador] = useState("");
  const [gateway, setGateway] = useState<GatewayCamposValue>(gatewayCamposIniciales());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!codigo || !ubicacion || !controlador) {
      setError("Código, ubicación y controlador son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/iot/cruces", {
        method: "POST",
        body: JSON.stringify({
          codigo,
          ubicacion,
          controlador,
          modelo: gateway.modelo || null,
          estado: gateway.estado,
          fechaInstalacion: gateway.fechaInstalacion || null,
          fechaDesinstalacion: gateway.fechaDesinstalacion || null,
          enMantencion: gateway.enMantencion,
        }),
      });
      showToast(`Cruce ${codigo} registrado.`, "success");
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo registrar el cruce";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Registrar cruce manual" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Código de cruce</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: 1050"
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1.5">Controlador</label>
            <input
              value={controlador}
              onChange={(e) => setControlador(e.target.value)}
              placeholder="Auter A5"
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Ubicación</label>
          <input
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ej: Nombre calle / Nombre calle"
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <GatewayCampos value={gateway} onChange={(patch) => setGateway((g) => ({ ...g, ...patch }))} />

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Guardando…" : "Registrar cruce"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
