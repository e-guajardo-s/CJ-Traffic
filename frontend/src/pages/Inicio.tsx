import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import Modal from "../components/Modal";

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

type TipoAviso = "INFO" | "MANTENCION" | "ADVERTENCIA" | "URGENTE";

interface Aviso {
  id: number;
  titulo: string;
  cuerpo: string;
  tipo: TipoAviso;
  presentacion: "BANNER" | "POPUP";
  fechaProgramada: string | null;
  vigenteHasta: string | null;
  autor: { nombre: string };
}

const TIPO_ESTILO: Record<TipoAviso, { caja: string; icono: string }> = {
  INFO: { caja: "bg-sky-50 border-sky-200 text-sky-800", icono: "text-sky-500" },
  MANTENCION: { caja: "bg-amber-50 border-amber-200 text-amber-800", icono: "text-amber-500" },
  ADVERTENCIA: { caja: "bg-orange-50 border-orange-200 text-orange-800", icono: "text-orange-500" },
  URGENTE: { caja: "bg-red-50 border-red-200 text-red-800", icono: "text-red-500" },
};
const TIPO_LABEL: Record<TipoAviso, string> = { INFO: "Info", MANTENCION: "Mantención", ADVERTENCIA: "Advertencia", URGENTE: "Urgente" };

function fmtFecha(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function AvisoIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function Inicio() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [popupActivo, setPopupActivo] = useState<Aviso | null>(null);

  useEffect(() => {
    apiFetch<Aviso[]>("/me/avisos")
      .then((data) => {
        setAvisos(data);
        const popup = data.find((a) => a.presentacion === "POPUP" && !localStorage.getItem(`avisoVisto:${a.id}`));
        if (popup) setPopupActivo(popup);
      })
      .catch(() => {
        // El feed de avisos es informativo, no bloquea el resto de Inicio.
      });
  }, []);

  function cerrarPopup() {
    if (popupActivo) localStorage.setItem(`avisoVisto:${popupActivo.id}`, "1");
    setPopupActivo(null);
  }

  const banners = avisos.filter((a) => a.presentacion === "BANNER");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-neutral-800">Bienvenido a la Intranet de Operaciones</h2>
        <p className="text-sm text-neutral-500 mt-1">Punto de partida y accesos rápidos del ecosistema tecnológico de CJ Traffic.</p>
      </div>

      {banners.length > 0 && (
        <div className="space-y-2 lg:max-w-3xl">
          {banners.map((a) => {
            const estilo = TIPO_ESTILO[a.tipo];
            return (
              <div key={a.id} className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${estilo.caja}`}>
                <AvisoIcon className={`shrink-0 mt-0.5 ${estilo.icono}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold">{a.titulo}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{TIPO_LABEL[a.tipo]}</span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-90">{a.cuerpo}</p>
                  {(a.fechaProgramada || a.vigenteHasta) && (
                    <p className="text-[11px] mt-1 opacity-70">
                      {a.fechaProgramada && `Programado ${fmtFecha(a.fechaProgramada)}`}
                      {a.fechaProgramada && a.vigenteHasta && " · "}
                      {a.vigenteHasta && `Vigente hasta ${fmtFecha(a.vigenteHasta)}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {popupActivo && (
        <Modal title={TIPO_LABEL[popupActivo.tipo]} onClose={cerrarPopup}>
          <div className="space-y-3">
            <p className="text-sm font-bold text-neutral-800">{popupActivo.titulo}</p>
            <p className="text-sm text-neutral-600 leading-relaxed">{popupActivo.cuerpo}</p>
            {(popupActivo.fechaProgramada || popupActivo.vigenteHasta) && (
              <p className="text-xs text-neutral-400">
                {popupActivo.fechaProgramada && `Programado ${fmtFecha(popupActivo.fechaProgramada)}`}
                {popupActivo.fechaProgramada && popupActivo.vigenteHasta && " · "}
                {popupActivo.vigenteHasta && `Vigente hasta ${fmtFecha(popupActivo.vigenteHasta)}`}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={cerrarPopup}
                className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
