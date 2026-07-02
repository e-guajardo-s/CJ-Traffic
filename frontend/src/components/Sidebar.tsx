import { NavLink } from "react-router-dom";
import type { Modulo } from "../types";
import { MODULO_LABEL, SUBMODULOS } from "../types";

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
                isActive ? "bg-orange-500 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"
              }`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
