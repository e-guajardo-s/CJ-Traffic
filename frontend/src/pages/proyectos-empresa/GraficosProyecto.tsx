import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line, Legend } from "recharts";

// ────────── Types ──────────
// Tipos locales mínimos (mismo patrón que el resto de proyectos-empresa: cada
// componente declara solo lo que necesita, sin importar entre archivos hermanos).

interface SubtareaLite {
  estado: string;
  fechaVencimiento: string | null;
  updatedAt: string;
}

interface TrackLite {
  tipo: string;
  nombre: string | null;
  estadoActual: string;
  subtareas: SubtareaLite[];
}

interface ObraLite {
  fechaInicio: string | null;
  fechaEntrega: string | null;
  tracks: TrackLite[];
}

// ────────── Clasificación por avance (duplica la lógica de ProyectoEmpresaDetalle.tsx;
// mantener en sync si se agregan estados legacy nuevos — no se comparte por el
// patrón de tipos locales del módulo) ──────────

type Bucket = "NO_INICIADO" | "EN_CURSO" | "ESPERANDO" | "CASI_COMPLETO" | "COMPLETADO" | "BLOQUEADO";

function clasificarEstado(estadoActual: string): Bucket {
  const e = estadoActual.toUpperCase();
  if (e.startsWith("BLOQUEADO")) return "BLOQUEADO";
  if (e.includes("ESPERANDO")) return "ESPERANDO";
  if (["COMPLETADO", "FINALIZADO", "DESPACHADO", "RECIBIDO", "CERRADO"].some((s) => e.includes(s))) return "COMPLETADO";
  if (["APROBADO", "TERRENO", "REVISION", "REVISADO"].some((s) => e.includes(s))) return "CASI_COMPLETO";
  if (["EN_CURSO", "TRAMITE", "PROCESO", "COTIZANDO", "ORDEN_COMPRA"].some((s) => e.includes(s))) return "EN_CURSO";
  return "NO_INICIADO";
}

const BUCKET_COLOR: Record<Bucket, string> = {
  NO_INICIADO: "#a3a3a3",
  EN_CURSO: "#0ea5e9",
  ESPERANDO: "#f59e0b",
  CASI_COMPLETO: "#14b8a6",
  COMPLETADO: "#10b981",
  BLOQUEADO: "#ef4444",
};

const TRACK_LABEL: Record<string, string> = {
  PERMISOS: "Permisos",
  ADQUISICIONES: "Materiales",
  PROGRAMACION: "Programación",
  INSTALACION: "Instalación",
  COMUNICACIONES: "Enlace",
  ENLACES: "Enlaces",
  EMPALMES: "Empalmes",
  HITOS_UOCT: "Hitos UOCT",
  SINTONIA_FINA: "Sintonía Fina",
  TRASPASOS_MANTENCION: "Traspasos y Mantención",
  CANALIZACION: "Canalización",
  OBRAS_CIVILES: "Obras Civiles",
};

function labelTrackGrafico(track: { tipo: string; nombre: string | null }): string {
  if (track.tipo === "OTRO") return track.nombre || "Otro";
  return TRACK_LABEL[track.tipo] ?? track.tipo;
}

const fmtFechaCorta = (t: number) => new Date(t).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

// ────────── Avance por línea de trabajo (barras horizontales) ──────────

function AvancePorTrackChart({ tracks }: { tracks: TrackLite[] }) {
  const data = tracks.map((t) => {
    const total = t.subtareas.length;
    const hechas = t.subtareas.filter((s) => s.estado === "HECHO").length;
    return {
      name: labelTrackGrafico(t),
      pct: total > 0 ? Math.round((hechas / total) * 100) : 0,
      bucket: clasificarEstado(t.estadoActual),
    };
  });

  if (data.length === 0) {
    return <p className="text-xs text-neutral-400 italic">Sin líneas de trabajo.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}%`, "Avance"]} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d, i) => <Cell key={i} fill={BUCKET_COLOR[d.bucket]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ────────── Línea de tiempo del proyecto (inicio → hoy → entrega) ──────────

function LineaTiempoFases({ fechaInicio, fechaEntrega }: { fechaInicio: string | null; fechaEntrega: string | null }) {
  if (!fechaInicio || !fechaEntrega) {
    return <p className="text-xs text-neutral-400 italic">Define fecha de inicio y de entrega para ver la línea de tiempo.</p>;
  }
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaEntrega).getTime();
  const hoy = Date.now();
  const total = fin - inicio;
  const pct = total > 0 ? Math.min(100, Math.max(0, ((hoy - inicio) / total) * 100)) : 0;
  const vencido = hoy > fin;

  return (
    <div>
      <div className="flex justify-between text-[11px] text-neutral-500 mb-1.5">
        <span>{new Date(inicio).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
        <span className={vencido ? "text-red-600 font-bold" : ""}>{new Date(fin).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full transition-all ${vencido ? "bg-red-400" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
        {!vencido && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-neutral-700" style={{ left: `${pct}%` }} title="Hoy" />
        )}
      </div>
      <p className="text-[11px] text-neutral-400 mt-1.5">
        {vencido ? "Fecha de entrega vencida" : `${Math.round(pct)}% del plazo transcurrido`}
      </p>
    </div>
  );
}

// ────────── Curva S: avance planificado vs. real acumulado ──────────
// Planificado(t) = % de subtareas cuya fechaVencimiento ≤ t.
// Real(t) = % de subtareas HECHO cuyo último cambio (updatedAt) ≤ t, solo hasta
// hoy — updatedAt es una aproximación honesta de la fecha de término real (no
// existe un campo "fechaCompletado" dedicado en el modelo).

function construirCurvaS(obra: ObraLite) {
  const subtareas = obra.tracks.flatMap((t) => t.subtareas);
  const N = subtareas.length;
  if (N === 0) return [];

  const fechasVenc = subtareas
    .map((s) => s.fechaVencimiento)
    .filter((f): f is string => !!f)
    .map((f) => new Date(f).getTime());
  const fechasHechas = subtareas
    .filter((s) => s.estado === "HECHO")
    .map((s) => new Date(s.updatedAt).getTime());

  const hoy = Date.now();
  let inicio = obra.fechaInicio ? new Date(obra.fechaInicio).getTime() : Math.min(...fechasVenc, hoy);
  let fin = obra.fechaEntrega ? new Date(obra.fechaEntrega).getTime() : Math.max(...fechasVenc, hoy);
  if (fechasVenc.length) fin = Math.max(fin, ...fechasVenc);
  if (inicio >= fin) fin = inicio + 7 * 24 * 60 * 60 * 1000;

  const finReal = Math.min(hoy, fin);
  const DIA = 24 * 60 * 60 * 1000;
  const pasos = 20;
  const intervalo = Math.max(DIA, Math.round((fin - inicio) / pasos));

  const puntos: { fecha: number; planificado: number; real?: number }[] = [];
  for (let t = inicio; t <= fin; t += intervalo) {
    const planificado = Math.round((fechasVenc.filter((f) => f <= t).length / N) * 100);
    const punto: { fecha: number; planificado: number; real?: number } = { fecha: t, planificado };
    if (t <= finReal) punto.real = Math.round((fechasHechas.filter((f) => f <= t).length / N) * 100);
    puntos.push(punto);
  }
  if (puntos[puntos.length - 1]?.fecha !== fin) {
    const planificado = Math.round((fechasVenc.filter((f) => f <= fin).length / N) * 100);
    const punto: { fecha: number; planificado: number; real?: number } = { fecha: fin, planificado };
    if (fin <= finReal) punto.real = Math.round((fechasHechas.filter((f) => f <= fin).length / N) * 100);
    puntos.push(punto);
  }
  return puntos;
}

function CurvaSChart({ obra }: { obra: ObraLite }) {
  const data = construirCurvaS(obra);
  if (data.length === 0) {
    return <p className="text-xs text-neutral-400 italic">Aún no hay tareas para calcular la curva S.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="fecha"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtFechaCorta}
          tick={{ fontSize: 10 }}
        />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip
          labelFormatter={(v) => new Date(v as number).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
          formatter={(v, name) => [`${v}%`, name === "planificado" ? "Planificado" : "Real"]}
        />
        <Legend formatter={(v) => (v === "planificado" ? "Planificado" : "Real")} />
        <Line type="monotone" dataKey="planificado" stroke="#f97316" strokeDasharray="5 5" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="real" stroke="#0f172a" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ────────── Componente principal ──────────

export default function GraficosProyecto({ obra }: { obra: ObraLite }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Avance por línea de trabajo</h3>
        <AvancePorTrackChart tracks={obra.tracks} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Línea de tiempo del proyecto</h3>
        <LineaTiempoFases fechaInicio={obra.fechaInicio} fechaEntrega={obra.fechaEntrega} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-1">Curva S — Avance planificado vs. real</h3>
        <p className="text-[11px] text-neutral-400 mb-4">
          Planificado según fecha de vencimiento de cada tarea; real según la fecha del último cambio a "Hecho" (aproximación).
        </p>
        <CurvaSChart obra={obra} />
      </div>
    </div>
  );
}
