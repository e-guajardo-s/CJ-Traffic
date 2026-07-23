export type Modulo = "iot" | "firmware" | "admin" | "proyectos_empresa";
export const MODULOS: Modulo[] = ["iot", "firmware", "proyectos_empresa", "admin"];

export function esModulo(v: string | undefined): v is Modulo {
  return v === "iot" || v === "firmware" || v === "admin" || v === "proyectos_empresa";
}

export type SubVistaIot = "resumen" | "directorio" | "inventario" | "proyectos" | "tecnologias" | "glosario" | "troubleshooting";
export type SubVistaFirmware = "resumen" | "historial";
export type SubVistaAdmin = "usuarios" | "areas" | "avisos";
export type SubVistaProyectosEmpresa = "panel" | "tablero" | "alertas";
export type SubVista = SubVistaIot | SubVistaFirmware | SubVistaAdmin | SubVistaProyectosEmpresa;

export interface SubModuloDef {
  id: SubVista;
  label: string;
}

export const SUBMODULOS: Record<Modulo, SubModuloDef[]> = {
  iot: [
    { id: "resumen", label: "Resumen" },
    { id: "directorio", label: "Directorio de Gateways" },
    { id: "inventario", label: "Inventario" },
    { id: "proyectos", label: "Proyectos" },
    { id: "tecnologias", label: "I+D y Tecnologías" },
    { id: "glosario", label: "Glosario Técnico" },
    { id: "troubleshooting", label: "Troubleshooting" },
  ],
  firmware: [
    { id: "resumen", label: "Resumen" },
    { id: "historial", label: "Historial y Feedback" },
  ],
  proyectos_empresa: [
    { id: "panel", label: "Panel Ejecutivo" },
    { id: "tablero", label: "Listado" },
    { id: "alertas", label: "Gestión de Alertas" },
  ],
  admin: [
    { id: "usuarios", label: "Usuarios" },
    { id: "areas", label: "Áreas" },
    { id: "avisos", label: "Avisos" },
  ],
};

export const MODULO_LABEL: Record<Modulo, string> = {
  iot: "Desarrollo",
  firmware: "Firmware Controladores",
  proyectos_empresa: "Proyectos",
  admin: "Administración",
};

export function esSubVistaDe(modulo: Modulo, v: string | undefined): v is SubVista {
  return SUBMODULOS[modulo].some((s) => s.id === v);
}

