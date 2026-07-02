import { useState, type FormEvent } from "react";
import { useAuth } from "../AuthContext";
import { ApiError } from "../api";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("cjtraffic123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full" style={{ colorScheme: "light" }}>
      {/* Panel izquierdo: login sobre fondo blanco corporativo */}
      <div className="flex w-full items-center justify-center bg-white px-8 py-12 md:w-1/2 lg:w-2/5">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo.png" alt="CJ Traffic" className="h-16 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">CJ Traffic</h1>
              <p className="text-xs uppercase tracking-widest text-neutral-500">Intranet Operativa</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Email de la empresa</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre.apellido@cjtraffic.cl"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/30 transition hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-neutral-400">
            Acceso corporativo CJ Traffic Chile.
            <br />
            Contacta a Desarrollo Tecnológico si no recuerdas tu clave.
          </p>
        </form>
      </div>

      {/* Panel derecho: fotografía a pantalla completa, oculto en mobile */}
      <div
        className="hidden bg-cover bg-center md:block md:w-1/2 lg:w-3/5"
        style={{ backgroundImage: "url(/background.jpg)" }}
      />
    </div>
  );
}
