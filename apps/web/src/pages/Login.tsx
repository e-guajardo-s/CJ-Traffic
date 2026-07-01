import { useState, type FormEvent } from "react";
import { useAuth } from "../AuthContext";
import { ApiError } from "../api";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-8 space-y-4">
        <h1 className="text-lg font-bold text-neutral-100">Intranet CJ Traffic</h1>
        <p className="text-xs text-neutral-500">Área de Desarrollo — IoT &amp; Firmware</p>

        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1.5">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-3 py-2"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
