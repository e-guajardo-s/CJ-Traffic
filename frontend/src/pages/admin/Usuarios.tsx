import { useState } from "react";
import { apiFetch, ApiError } from "../../api";
import Modal from "../../components/Modal";
import { showToast } from "../../components/toast";
import type { Area, Rol, Usuario } from "./types";
import { ROL_COLOR_BADGE, ROL_LABEL } from "../../roles";
import { useAuth } from "../../AuthContext";

export default function Usuarios({
  usuarios,
  roles,
  areas,
  onChange,
}: {
  usuarios: Usuario[];
  roles: Rol[];
  areas: Area[];
  onChange: () => void;
}) {
  const { usuario: yo } = useAuth();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  async function eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar el usuario "${u.nombre}"? Esta acción es irreversible.`)) return;
    try {
      await apiFetch(`/admin/usuarios/${u.id}`, { method: "DELETE" });
      showToast("Usuario eliminado", "success");
      onChange();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo eliminar el usuario";
      showToast(msg, "error");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Usuarios del sistema</h2>
        <button
          onClick={() => setCreando(true)}
          className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg cursor-pointer"
        >
          + Nuevo usuario
        </button>
      </div>
      <p className="text-xs text-neutral-500 mb-5">
        Creación de cuentas y asignación de roles/áreas. Un usuario puede tener más de un rol (ej. Desarrollo + apoyo en Mantención).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-200">
              <th className="py-3 pr-4">Nombre</th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Roles</th>
              <th className="py-3 pr-4">Áreas</th>
              <th className="py-3 pr-4 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="py-3 pr-4 font-semibold text-neutral-700">{u.nombre}</td>
                <td className="py-3 pr-4 text-neutral-500 font-mono text-[13px]">{u.email}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROL_COLOR_BADGE[r] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                        {ROL_LABEL[r] ?? r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {u.areas.length === 0 ? (
                      <span className="text-[11px] text-neutral-300">—</span>
                    ) : (
                      u.areas.map((a) => (
                        <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-neutral-100 text-neutral-600 border-neutral-200">
                          {a}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setEditando(u)} title="Editar" className="text-neutral-400 hover:text-orange-600 cursor-pointer p-1">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                    </button>
                    {u.id !== yo?.id && (
                      <button onClick={() => eliminar(u)} title="Eliminar" className="text-neutral-400 hover:text-red-500 cursor-pointer p-1">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creando && (
        <UsuarioModal
          roles={roles}
          areas={areas}
          onClose={() => setCreando(false)}
          onSaved={() => {
            setCreando(false);
            onChange();
          }}
        />
      )}
      {editando && (
        <UsuarioModal
          usuario={editando}
          roles={roles}
          areas={areas}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function UsuarioModal({
  usuario,
  roles,
  areas,
  onClose,
  onSaved,
}: {
  usuario?: Usuario;
  roles: Rol[];
  areas: Area[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!usuario;
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [password, setPassword] = useState("");
  const [rolIds, setRolIds] = useState<Set<number>>(
    new Set(usuario ? roles.filter((r) => usuario.roles.includes(r.nombre)).map((r) => r.id) : [])
  );
  const [areaIds, setAreaIds] = useState<Set<number>>(
    new Set(usuario ? areas.filter((a) => usuario.areas.includes(a.nombre)).map((a) => a.id) : [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRol(id: number) {
    setRolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleArea(id: number) {
    setAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar() {
    setError(null);
    if (!nombre.trim() || !email.trim() || rolIds.size === 0) {
      setError("Nombre, email y al menos un rol son obligatorios.");
      return;
    }
    if (!editando && !password) {
      setError("La contraseña es obligatoria al crear un usuario.");
      return;
    }
    if (password && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await apiFetch(`/admin/usuarios/${usuario!.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            nombre: nombre.trim(),
            email: email.trim(),
            ...(password ? { password } : {}),
            rolIds: [...rolIds],
            areaIds: [...areaIds],
          }),
        });
        showToast(`Usuario ${nombre} actualizado.`, "success");
      } else {
        await apiFetch("/admin/usuarios", {
          method: "POST",
          body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), password, rolIds: [...rolIds], areaIds: [...areaIds] }),
        });
        showToast(`Usuario ${nombre} creado.`, "success");
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar el usuario";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <Modal title={editando ? `Editar ${usuario!.nombre}` : "Nuevo usuario"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Nombre completo</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">Email corporativo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre.apellido@cjtraffic.cl"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">
            Roles <span className="text-neutral-400 font-normal">(al menos uno)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => {
              const activo = rolIds.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRol(r.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                >
                  {activo && "✓ "}{ROL_LABEL[r.nombre] ?? r.nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">
            Áreas <span className="text-neutral-400 font-normal">(opcional, organizativas)</span>
          </label>
          {areas.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Aún no hay áreas creadas.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => {
                const activo = areaIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleArea(a.id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${activo ? "bg-sky-100 border-sky-300 text-sky-700" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                  >
                    {activo && "✓ "}{a.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-neutral-500 block mb-1.5">
            {editando ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editando ? "Dejar vacío para no cambiarla" : "Mínimo 8 caracteres"}
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg cursor-pointer"
          >
            {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
