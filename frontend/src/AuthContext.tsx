import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, clearToken, getStoredUsuario, getToken, setStoredUsuario, setToken } from "./api";

type Nivel = "OCULTO" | "LECTURA" | "ESCRITURA";
type Permisos = Record<string, Nivel>;

interface Usuario {
  id: number;
  nombre: string;
  rol: string;
}

interface AuthState {
  usuario: Usuario | null;
  permisos: Permisos;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  puede: (modulo: string, nivel: Nivel) => boolean;
}

const RANGO: Record<Nivel, number> = { OCULTO: 0, LECTURA: 1, ESCRITURA: 2 };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => getStoredUsuario<Usuario>());
  const [permisos, setPermisos] = useState<Permisos>({});
  const [loading, setLoading] = useState(true);

  async function cargarPermisos() {
    const p = await apiFetch<Permisos>("/me/permissions");
    setPermisos(p);
  }

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    cargarPermisos()
      .catch(() => {
        clearToken();
        setUsuario(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await apiFetch<{ token: string; usuario: Usuario }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    // Se cargan los permisos antes de exponer `usuario`, para que las rutas que
    // redirigen según `puede()` no lo hagan con una matriz todavía vacía.
    const permisos = await apiFetch<Permisos>("/me/permissions");
    setStoredUsuario(data.usuario);
    setPermisos(permisos);
    setUsuario(data.usuario);
  }

  function logout() {
    clearToken();
    setUsuario(null);
    setPermisos({});
  }

  function puede(modulo: string, nivel: Nivel) {
    return RANGO[permisos[modulo] ?? "OCULTO"] >= RANGO[nivel];
  }

  return (
    <AuthContext.Provider value={{ usuario, permisos, loading, login, logout, puede }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
