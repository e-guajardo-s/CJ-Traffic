import { useState } from "react";
import SubcontratosModule from "./SubcontratosModule.tsx";
import MaterialesModule from "./MaterialesModule.tsx";

const TABS = [
  { id: "subcontratos", label: "Subcontratos y EPs" },
  { id: "materiales", label: "Materiales y Adquisiciones" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ControlCostosModule({ obraId, esCoordinadorAsignado = false }: { obraId?: number; esCoordinadorAsignado?: boolean }) {
  const [subTab, setSubTab] = useState<TabId>("subcontratos");

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="border-b border-neutral-200 bg-white px-8">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                subTab === tab.id
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="px-8">
        {subTab === "subcontratos" ? (
          <SubcontratosModule obraId={obraId} esSubTab={true} esCoordinadorAsignado={esCoordinadorAsignado} />
        ) : (
          <MaterialesModule obraId={obraId} />
        )}
      </div>
    </div>
  );
}
