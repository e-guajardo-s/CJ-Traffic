import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import IotModule from "./pages/iot";
import FirmwareModule from "./pages/firmware";
import AdminModule from "./pages/admin";
import ProyectosModule from "./pages/proyectos";
import ProyectoDetalle from "./pages/proyectos/ProyectoDetalle";
import ProyectosEmpresaModule from "./pages/proyectos-empresa";
import PanelSubgerente from "./pages/proyectos-empresa/PanelSubgerente";
import ProyectoEmpresaDetalle, { TrackVista } from "./pages/proyectos-empresa/ProyectoEmpresaDetalle";
import TecnologiasModule from "./pages/iot/Tecnologias";
import GlosarioModule from "./pages/iot/Glosario";
import TroubleshootingModule from "./pages/iot/Troubleshooting";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/ToastContainer";
import { esModulo, esSubVistaDe, MODULOS, SUBMODULOS } from "./types";

function LoginRoute() {
  const { usuario, loading } = useAuth();
  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (usuario) return <Navigate to="/" replace />;
  return <Login />;
}

// Inicio: la misma pantalla de aterrizaje para cualquier rol autenticado, sin
// depender de la matriz de permisos por módulo (a diferencia de ModuloPage).
function InicioRoute() {
  const { usuario, loading, logout } = useAuth();
  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <AppShell usuario={usuario} onLogout={logout}>
      <Inicio />
    </AppShell>
  );
}

function ModuloPage() {
  const { usuario, loading, logout, puede } = useAuth();
  const { modulo, submodulo } = useParams();

  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!esModulo(modulo) || !puede(modulo, "LECTURA")) return <Navigate to="/" replace />;
  if (!esSubVistaDe(modulo, submodulo)) return <Navigate to={`/${modulo}/${SUBMODULOS[modulo][0].id}`} replace />;

  return (
    <AppShell usuario={usuario} onLogout={logout} sidebar={<Sidebar modulo={modulo} />}>
      {modulo === "iot" && submodulo === "proyectos" && <ProyectosModule />}
      {modulo === "iot" && submodulo === "tecnologias" && <TecnologiasModule />}
      {modulo === "iot" && submodulo === "glosario" && <GlosarioModule />}
      {modulo === "iot" && submodulo === "troubleshooting" && <TroubleshootingModule />}
      {modulo === "iot" && !["proyectos", "tecnologias", "glosario", "troubleshooting"].includes(submodulo) && (
        <IotModule submodulo={submodulo as "resumen" | "directorio" | "inventario"} />
      )}
      {modulo === "firmware" && <FirmwareModule submodulo={submodulo as "resumen" | "historial"} />}
      {modulo === "proyectos_empresa" && submodulo === "panel" && <PanelSubgerente />}
      {modulo === "proyectos_empresa" && submodulo !== "panel" && <ProyectosEmpresaModule />}
      {modulo === "admin" && <AdminModule submodulo={submodulo as "usuarios"} />}
    </AppShell>
  );
}

// Workspace de un proyecto individual (kanban + documentación) — submódulo de
// Desarrollo (iot), en ruta aparte del patrón genérico /:modulo/:submodulo
// porque necesita un id de proyecto.
function ProyectoDetallePage() {
  const { usuario, loading, logout, puede } = useAuth();
  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!puede("iot", "LECTURA")) return <Navigate to="/" replace />;

  return (
    <AppShell usuario={usuario} onLogout={logout} sidebar={<Sidebar modulo="iot" />}>
      <ProyectoDetalle />
    </AppShell>
  );
}

function ProyectoEmpresaDetallePage() {
  const { usuario, loading, logout } = useAuth();
  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <AppShell usuario={usuario} onLogout={logout} sidebar={<Sidebar modulo="proyectos_empresa" />}>
      <ProyectoEmpresaDetalle />
    </AppShell>
  );
}

// Vista de una línea de trabajo (kanban de subtareas) — ruta propia dentro del
// layout con header + sidebar, igual que el resto de las vistas.
function ProyectoEmpresaTrackPage() {
  const { usuario, loading, logout } = useAuth();
  if (loading) return <p className="text-sm text-neutral-500 p-8">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <AppShell usuario={usuario} onLogout={logout} sidebar={<Sidebar modulo="proyectos_empresa" />}>
      <TrackVista />
    </AppShell>
  );
}

function AppShell({
  usuario,
  onLogout,
  sidebar,
  children,
}: {
  usuario: { nombre: string; rol: string };
  onLogout: () => void;
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  const { puede } = useAuth();
  const modulos = MODULOS.filter((m) => puede(m, "LECTURA"));

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-800">
      <Header modulos={modulos} usuario={usuario} onLogout={onLogout} />

      <div className="flex flex-1 min-h-0">
        {sidebar}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      <ToastContainer />
    </div>
  );
}

function RootRedirectAModulo() {
  const { modulo } = useParams();
  if (!esModulo(modulo)) return <Navigate to="/" replace />;
  return <Navigate to={`/${modulo}/${SUBMODULOS[modulo][0].id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/" element={<InicioRoute />} />
          <Route path="/iot/proyectos/:proyectoId" element={<ProyectoDetallePage />} />
          <Route path="/proyectos_empresa/detalle/:proyectoId" element={<ProyectoEmpresaDetallePage />} />
          <Route path="/proyectos_empresa/detalle/:proyectoId/track/:trackId" element={<ProyectoEmpresaTrackPage />} />
          <Route path="/:modulo" element={<RootRedirectAModulo />} />
          <Route path="/:modulo/:submodulo" element={<ModuloPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
