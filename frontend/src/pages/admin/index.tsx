import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import type { SubVistaAdmin } from "../../types";
import type { Area, Aviso, Rol, Usuario } from "./types";
import Usuarios from "./Usuarios";
import Areas from "./Areas";
import Avisos from "./Avisos";
import CargandoTabla from "../../components/CargandoTabla";

export default function AdminModule({ submodulo }: { submodulo: SubVistaAdmin }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [roles, setRoles] = useState<Rol[] | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    Promise.all([
      apiFetch<Usuario[]>("/admin/usuarios"),
      apiFetch<Rol[]>("/admin/roles"),
      apiFetch<Area[]>("/admin/areas"),
      apiFetch<Aviso[]>("/admin/avisos"),
    ])
      .then(([u, r, a, av]) => {
        setUsuarios(u);
        setRoles(r);
        setAreas(a);
        setAvisos(av);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!usuarios || !roles || !areas || !avisos) return <CargandoTabla />;

  if (submodulo === "areas") return <Areas areas={areas} onChange={cargar} />;
  if (submodulo === "avisos") return <Avisos avisos={avisos} roles={roles} areas={areas} onChange={cargar} />;
  return <Usuarios usuarios={usuarios} roles={roles} areas={areas} onChange={cargar} />;
}
