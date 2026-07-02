export type Modulo = "iot" | "firmware" | "admin";
export const MODULOS: Modulo[] = ["iot", "firmware", "admin"];

export function esModulo(v: string | undefined): v is Modulo {
  return v === "iot" || v === "firmware" || v === "admin";
}

export type SubVistaIot = "resumen" | "directorio" | "inventario" | "proyectos" | "tecnologias" | "glosario";
export type SubVistaFirmware = "resumen" | "historial";
export type SubVistaAdmin = "usuarios";
export type SubVista = SubVistaIot | SubVistaFirmware | SubVistaAdmin;

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
  ],
  firmware: [
    { id: "resumen", label: "Resumen" },
    { id: "historial", label: "Historial y Feedback" },
  ],
  admin: [{ id: "usuarios", label: "Usuarios" }],
};

export const MODULO_LABEL: Record<Modulo, string> = {
  iot: "Desarrollo",
  firmware: "Firmware Controladores",
  admin: "Administración",
};

export function esSubVistaDe(modulo: Modulo, v: string | undefined): v is SubVista {
  return SUBMODULOS[modulo].some((s) => s.id === v);
}
