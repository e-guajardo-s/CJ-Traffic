import { useState } from "react";
import { apiFetch, ApiError } from "../../api";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import type { Rol, Usuario } from "./types";

const ROL_COLOR: Record<string, string> = {
  gerencia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  jefatura: "bg-amber-50 text-amber-700 border-amber-200",
  coordinador: "bg-sky-50 text-sky-700 border-sky-200",
  bodega: "bg-orange-50 text-orange-700 border-orange-200",
  contabilidad: "bg-teal-50 text-teal-700 border-teal-200",
  desarrollo: "bg-violet-50 text-violet-700 border-violet-200",
  firmware: "bg-pink-50 text-pink-700 border-pink-200",
  tecnico: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export default function Usuarios({ usuarios, roles, onChange }: { usuarios: Usuario[]; roles: Rol[]; onChange: () => void }) {
  const [creando, setCreando] = useState(false);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Usuarios del sistema</h2>
        <button
          onClick={() => setCreando(true)}
          className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
        >
          + Nuevo usuario
        </button>
      </div>
      <p className="text-xs text-neutral-500 mb-5">
        Creación de cuentas y asignación de rol. El nivel de acceso a cada módulo se define por rol, no por usuario.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-200">
              <th className="py-3 pr-4">Nombre</th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="py-3 pr-4 font-semibold text-neutral-700">{u.nombre}</td>
                <td className="py-3 pr-4 text-neutral-500 font-mono text-[13px]">{u.email}</td>
                <td className="py-3 pr-4">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full border capitalize ${ROL_COLOR[u.rol] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                    {u.rol}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creando && (
        <NuevoUsuarioModal
          roles={roles}
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function NuevoUsuarioModal({ roles, onClose, onCreated }: { roles: Rol[]; onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState<number | "">(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!nombre || !email || !password || !rolId) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({ nombre, email, password, rolId }),
      });
      showToast(`Usuario ${nombre} creado.`, "success");
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo crear el usuario";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre completo</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Email corporativo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre.apellido@cjtraffic.cl"
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Rol</label>
          <select
            value={rolId}
            onChange={(e) => setRolId(Number(e.target.value))}
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 capitalize focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id} className="capitalize">
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Contraseña temporal</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

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
            {saving ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
