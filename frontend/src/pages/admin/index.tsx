import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import type { SubVistaAdmin } from "../../types";
import type { Rol, Usuario } from "./types";
import Usuarios from "./Usuarios";

export default function AdminModule({ submodulo: _submodulo }: { submodulo: SubVistaAdmin }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [roles, setRoles] = useState<Rol[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    Promise.all([apiFetch<Usuario[]>("/admin/usuarios"), apiFetch<Rol[]>("/admin/roles")])
      .then(([u, r]) => {
        setUsuarios(u);
        setRoles(r);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!usuarios || !roles) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return <Usuarios usuarios={usuarios} roles={roles} onChange={cargar} />;
}
