import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "../api";

export interface TerminoGlosario {
  id: number;
  termino: string;
  definicion: string;
}

interface TextoGlosarioProps {
  texto: string;
  className?: string;
}

export function TextoGlosario({ texto, className = "" }: TextoGlosarioProps) {
  const [glosario, setGlosario] = useState<TerminoGlosario[]>([]);

  useEffect(() => {
    apiFetch<TerminoGlosario[]>("/admin/glosario")
      .then(setGlosario)
      .catch(() => {
        // Fallback en caso de error o entorno local desconectado
        setGlosario([
          { id: 1, termino: "MQTT", definicion: "Protocolo de comunicación ultraligero usado para transmitir telemetría desde los gateways Teltonika a la central en milisegundos." },
          { id: 2, termino: "PLC", definicion: "Controlador Lógico Programable. Es el cerebro industrial que opera los semáforos en el cruce físico." },
          { id: 3, termino: "YOLO", definicion: "Arquitectura de Inteligencia Artificial especializada en detectar y clasificar vehículos en tiempo real mediante visión artificial." },
          { id: 4, termino: "TIA Portal", definicion: "Software de Siemens utilizado para programar y diagnosticar el PLC de la intersección." },
          { id: 5, termino: "Edge AI", definicion: "Procesamiento de Inteligencia Artificial que ocurre directamente en el cruce (en hardware Nvidia), sin depender de la nube." }
        ]);
      });
  }, []);

  const partes = useMemo(() => {
    if (!texto) return [];
    if (glosario.length === 0) return [texto];

    // Creamos expresión regular dinámica para coincidir exactamente con los términos del glosario
    const terminosEscapados = glosario.map((t) => t.termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${terminosEscapados.join('|')})\\b`, 'gi');

    // Dividimos el texto. Las coincidencias quedan en índices impares
    return texto.split(regex);
  }, [texto, glosario]);

  return (
    <p className={`leading-relaxed ${className}`}>
      {partes.map((parte, index) => {
        const terminoEncontrado = glosario.find(
          (t) => t.termino.toLowerCase() === parte.toLowerCase()
        );

        if (terminoEncontrado) {
          return (
            <span key={index} className="relative group inline-block cursor-help">
              {/* Palabra Subrayada en Naranja */}
              <span className="underline decoration-orange-400/50 decoration-2 underline-offset-4 font-semibold text-neutral-800 transition-colors group-hover:text-orange-600 group-hover:decoration-orange-500">
                {parte}
              </span>

              {/* Tooltip interactivo al hacer Hover */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-neutral-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-left pointer-events-none">
                <span className="font-black text-orange-400 block mb-1 uppercase tracking-wider">
                  {terminoEncontrado.termino}
                </span>
                <span className="leading-snug text-neutral-300 font-medium block">
                  {terminoEncontrado.definicion}
                </span>
                {/* Flechita del Tooltip */}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-neutral-900 block" />
              </span>
            </span>
          );
        }

        return <span key={index}>{parte}</span>;
      })}
    </p>
  );
}
