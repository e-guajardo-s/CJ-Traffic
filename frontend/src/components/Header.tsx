import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { Modulo } from "../types";
import { MODULO_LABEL } from "../types";
import { ROL_COLOR_SOLIDO, ROL_LABEL } from "../roles";

// Tema persistente: localStorage manda; si no hay preferencia guardada se usa
// la del sistema operativo.
function temaInicial(): "light" | "dark" {
  const guardado = localStorage.getItem("tema");
  if (guardado === "dark" || guardado === "light") return guardado;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function BotonTema() {
  const [tema, setTema] = useState<"light" | "dark">(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    localStorage.setItem("tema", tema);
  }, [tema]);

  return (
    <button
      onClick={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-600 transition"
      title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Alternar modo oscuro"
    >
      {tema === "dark" ? (
        // Sol
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Luna
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

const ICONS: Record<Modulo, ReactNode> = {
  iot: (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
    </svg>
  ),
  firmware: (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </svg>
  ),
  admin: (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  proyectos_empresa: (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

function initials(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function Header({
  modulos,
  usuario,
  onLogout,
}: {
  modulos: Modulo[];
  usuario: { nombre: string; roles: string[] };
  onLogout: () => void;
}) {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-6 gap-6">
      <div className="flex items-center gap-8 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="CJ Traffic" className="h-8 w-auto dark:hidden" />
          <img src="/logo2.png" alt="CJ Traffic" className="hidden h-8 w-auto dark:block" />
        </div>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive ? "bg-orange-50 text-orange-600" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              }`
            }
          >
            Inicio
          </NavLink>
          {modulos.map((m) => (
            <NavLink
              key={m}
              to={`/${m}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive ? "bg-orange-50 text-orange-600" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                }`
              }
            >
              {ICONS[m]} {MODULO_LABEL[m]}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <BotonTema />
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full ${ROL_COLOR_SOLIDO[usuario.roles[0]] ?? "bg-neutral-500"} flex items-center justify-center text-[11px] font-bold text-white`}>
            {initials(usuario.nombre)}
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate leading-tight">{usuario.nombre}</p>
            <p className="text-[11px] text-neutral-500 truncate leading-tight">
              {usuario.roles.map((r) => ROL_LABEL[r] ?? r).join(" · ")}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
