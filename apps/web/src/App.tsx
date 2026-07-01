import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Iot from "./pages/Iot";
import Firmware from "./pages/Firmware";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/ToastContainer";
import type { Vista } from "./types";

const TITULOS: Record<Vista, string> = { iot: "Infraestructura IoT", firmware: "Firmware Controladores" };

function Shell() {
  const { usuario, loading, logout, puede } = useAuth();
  const [vista, setVista] = useState<Vista>("iot");

  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Login />;

  const allTabs: Vista[] = ["iot", "firmware"];
  const tabs = allTabs.filter((v) => puede(v, "LECTURA"));
  const vistaActiva = tabs.includes(vista) ? vista : tabs[0];

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200">
      <Sidebar tabs={tabs} vista={vistaActiva} onSelect={setVista} usuario={usuario} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-neutral-900/80 backdrop-blur border-b border-neutral-800 flex items-center justify-between px-6 gap-4">
          <h1 className="text-lg font-bold text-neutral-100">{vistaActiva ? TITULOS[vistaActiva] : "Sin acceso"}</h1>
          <button
            onClick={logout}
            className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 rounded-lg"
          >
            Cerrar sesión
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {!vistaActiva && <p className="text-sm text-neutral-500">Sin módulos visibles para tu rol.</p>}
          {vistaActiva === "iot" && <Iot />}
          {vistaActiva === "firmware" && <Firmware />}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
