import type { ReactNode } from "react";
import type { Vista } from "../types";

const ROL_COLOR: Record<string, string> = {
  gerencia: "bg-emerald-600",
  jefatura: "bg-amber-600",
  coordinador: "bg-sky-600",
  bodega: "bg-orange-600",
  contabilidad: "bg-teal-600",
  desarrollo: "bg-violet-600",
  firmware: "bg-pink-600",
  tecnico: "bg-neutral-600",
};

function initials(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

const ICONS: Record<Vista, ReactNode> = {
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
};

const LABELS: Record<Vista, string> = { iot: "Infraestructura IoT", firmware: "Firmware Controladores" };

export default function Sidebar({
  tabs,
  vista,
  onSelect,
  usuario,
}: {
  tabs: Vista[];
  vista: Vista;
  onSelect: (v: Vista) => void;
  usuario: { nombre: string; rol: string };
}) {
  return (
    <aside className="w-64 shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col">
      <div className="px-5 py-5 border-b border-neutral-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center font-extrabold text-neutral-950 text-lg shadow-lg shadow-amber-500/20">
          CJ
        </div>
        <div>
          <p className="font-bold text-neutral-100 leading-tight">CJ Traffic</p>
          <p className="text-[11px] text-neutral-400 tracking-wide uppercase">Intranet Operativa</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-sm">
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Módulos</p>
        {tabs.map((v) => {
          const active = v === vista;
          return (
            <button
              key={v}
              onClick={() => onSelect(v)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800 ${
                active ? "bg-amber-500/10 text-amber-400" : "text-neutral-300"
              }`}
            >
              {ICONS[v]} {LABELS[v]}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-neutral-800">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${ROL_COLOR[usuario.rol] ?? "bg-neutral-600"} flex items-center justify-center text-xs font-bold text-white`}>
            {initials(usuario.nombre)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-100 truncate">{usuario.nombre}</p>
            <p className="text-[11px] text-neutral-400 truncate capitalize">{usuario.rol}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
