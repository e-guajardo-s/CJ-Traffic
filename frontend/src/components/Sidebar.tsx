import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { Modulo, SubVista } from "../types";
import { MODULO_LABEL, SUBMODULOS } from "../types";

function icono(path: ReactNode) {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

// Iconos por submódulo. Los ids repetidos entre módulos (ej. "resumen")
// comparten icono a propósito.
const ICONO_SUBVISTA: Record<SubVista, ReactNode> = {
  resumen: icono(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>,
  ),
  directorio: icono(
    <>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
    </>,
  ),
  inventario: icono(
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>,
  ),
  proyectos: icono(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M3 9h18" />
    </>,
  ),
  tecnologias: icono(
    <>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  historial: icono(
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>,
  ),
  usuarios: icono(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  glosario: icono(
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </>,
  ),
  troubleshooting: icono(
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>,
  ),
  tablero: icono(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>,
  ),
  panel: icono(
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>,
  ),
};

export default function Sidebar({ modulo }: { modulo: Modulo }) {
  const submodulos = SUBMODULOS[modulo];

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{MODULO_LABEL[modulo]}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {submodulos.map((s) => (
          <NavLink
            key={s.id}
            to={`/${modulo}/${s.id}`}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                isActive ? "bg-orange-500 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100 hover:translate-x-0.5"
              }`
            }
          >
            {ICONO_SUBVISTA[s.id]}
            {s.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
