interface AccesoRapido {
  href: string;
  logo: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  accent: string;
}

const ACCESOS: AccesoRapido[] = [
  {
    href: "https://cj-traffic.buk.cl/users/sign_in",
    logo: "/buk.png",
    nombre: "Portal de Personal",
    categoria: "RRHH y Finanzas",
    descripcion: "Solicitud de vacaciones, liquidaciones de sueldo, días administrativos y licencias.",
    accent: "border-indigo-200 hover:border-indigo-400 focus-visible:ring-indigo-400",
  },
  {
    href: "https://cjsmart.cl",
    logo: "/cjsmart.png",
    nombre: "CJ Smart Traffic",
    categoria: "Monitoreo Operativo",
    descripcion: "Verificación de conectividad en tiempo real, alarmas operativas y mapas de cruces viales.",
    accent: "border-emerald-200 hover:border-emerald-400 focus-visible:ring-emerald-400",
  },
];

export default function Inicio() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-neutral-800">Bienvenido a la Intranet de Operaciones</h2>
        <p className="text-sm text-neutral-500 mt-1">Punto de partida y accesos rápidos del ecosistema tecnológico de CJ Traffic.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:max-w-3xl">
        {ACCESOS.map((a) => (
          <a
            key={a.nombre}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group text-left bg-white border rounded-2xl p-5 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${a.accent}`}
          >
            <div className="flex items-start justify-between mb-6">
              <img src={a.logo} alt={a.nombre} className="h-12 w-auto object-contain" />
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-neutral-600">
                {a.categoria}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </span>
            </div>
            <p className="text-lg font-bold text-neutral-800">{a.nombre}</p>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{a.descripcion}</p>
          </a>
        ))}
      </div>

      {/* Próximamente: paneles de "Avisos del Taller y Bodega" y "Estado del Software",
          una vez existan las fuentes de datos reales para poblarlos. */}
    </div>
  );
}
