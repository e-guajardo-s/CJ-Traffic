import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api";
import { useAuth } from "../AuthContext";
import Modal from "../components/Modal";
import { showToast } from "../components/toast";

type EstadoGateway = "ONLINE" | "OFFLINE" | "DEGRADADO";

interface Cruce {
  id: number;
  codigo: string;
  ubicacion: string;
  controlador: string;
  gateway: {
    modelo: string;
    simApn: string;
    estado: EstadoGateway;
  } | null;
}

const ESTADOS: EstadoGateway[] = ["ONLINE", "OFFLINE", "DEGRADADO"];

const DOT: Record<string, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-red-500",
  DEGRADADO: "bg-amber-500",
};
const TEXT: Record<string, string> = {
  ONLINE: "text-emerald-400",
  OFFLINE: "text-red-400",
  DEGRADADO: "text-amber-400",
};

export default function Iot() {
  const { puede } = useAuth();
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cruce | null>(null);

  function cargar() {
    apiFetch<Cruce[]>("/iot/gateways")
      .then(setCruces)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!cruces) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-1">
        Mantenedor — Directorio de Telemetría IoT
      </h2>
      <p className="text-xs text-neutral-500 mb-5">
        Cruce semafórico ↔ Controlador ↔ Gateway de telemetría. Administrado por Desarrollo Tecnológico.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
              <th className="py-3 pr-4">ID Cruce</th>
              <th className="py-3 pr-4">Ubicación</th>
              <th className="py-3 pr-4">Controlador</th>
              <th className="py-3 pr-4">Gateway</th>
              <th className="py-3 pr-4">SIM / APN</th>
              <th className="py-3 pr-4">Estado</th>
              {puede("iot", "ESCRITURA") && <th className="py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70">
            {cruces.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-800/30">
                <td className="py-3 pr-4 font-mono font-bold text-amber-400">{c.codigo}</td>
                <td className="py-3 pr-4 text-neutral-200">{c.ubicacion}</td>
                <td className="py-3 pr-4">{c.controlador}</td>
                <td className="py-3 pr-4 font-mono text-violet-300">{c.gateway?.modelo ?? "—"}</td>
                <td className="py-3 pr-4 text-neutral-400">{c.gateway?.simApn ?? "—"}</td>
                <td className="py-3 pr-4">
                  {c.gateway && (
                    <span className={`inline-flex items-center gap-1.5 ${TEXT[c.gateway.estado]} text-xs font-bold`}>
                      <span className={`w-2 h-2 rounded-full ${DOT[c.gateway.estado]}`} />
                      {c.gateway.estado}
                    </span>
                  )}
                </td>
                {puede("iot", "ESCRITURA") && (
                  <td className="py-3 text-right">
                    <button
                      onClick={() => setEditando(c)}
                      className="text-[11px] font-bold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 rounded-md"
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarGatewayModal
          cruce={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function EditarGatewayModal({ cruce, onClose, onSaved }: { cruce: Cruce; onClose: () => void; onSaved: () => void }) {
  const [modelo, setModelo] = useState(cruce.gateway?.modelo ?? "");
  const [simApn, setSimApn] = useState(cruce.gateway?.simApn ?? "");
  const [estado, setEstado] = useState(cruce.gateway?.estado ?? "OFFLINE");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await apiFetch(`/iot/gateways/${cruce.id}`, {
        method: "PATCH",
        body: JSON.stringify({ modelo, simApn, estado }),
      });
      showToast(`Gateway de ${cruce.codigo} actualizado.`, "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Editar gateway — ${cruce.codigo}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">Modelo de gateway</label>
          <input
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">SIM / APN</label>
          <input
            value={simApn}
            onChange={(e) => setSimApn(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
