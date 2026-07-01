import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Iot from "./pages/Iot";
import Firmware from "./pages/Firmware";

type Vista = "iot" | "firmware";

function Shell() {
  const { usuario, loading, logout, puede } = useAuth();
  const [vista, setVista] = useState<Vista>("iot");

  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Login />;

  const allTabs: { id: Vista; label: string }[] = [
    { id: "iot", label: "IoT" },
    { id: "firmware", label: "Firmware" },
  ];
  const tabs = allTabs.filter((t) => puede(t.id, "LECTURA"));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">Intranet CJ Traffic — Área de Desarrollo</h1>
          <p className="text-xs text-neutral-500">{usuario.nombre} · {usuario.rol}</p>
        </div>
        <button onClick={logout} className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 rounded-lg">
          Cerrar sesión
        </button>
      </header>

      <nav className="px-6 pt-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setVista(t.id)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border ${
              vista === t.id
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tabs.length === 0 && <p className="text-sm text-neutral-500">Sin módulos visibles para tu rol.</p>}
        {vista === "iot" && puede("iot", "LECTURA") && <Iot />}
        {vista === "firmware" && puede("firmware", "LECTURA") && <Firmware />}
      </main>
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
