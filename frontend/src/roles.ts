// Catálogo compartido de roles de usuario: label legible, colores de
// etiqueta/avatar y helper de jefatura (hay dos roles de jefatura desde que
// se separó Carlos Salas — Jefe Construcción — de Víctor Aburto — Jefe
// Mantención — y ambos deben tratarse igual que la antigua "jefatura" única).

export const ROL_LABEL: Record<string, string> = {
  gerencia: "Gerencia",
  jefe_construccion: "Jefe Construcción",
  jefe_mantencion: "Jefe Mantención",
  coordinador: "Coordinador",
  bodega: "Bodega",
  contabilidad: "Contabilidad",
  desarrollo: "Desarrollo",
  firmware: "Firmware",
  tecnico: "Técnico",
};

// Badge tipo "chip" (fondo claro + borde), usado en tablas/listas.
export const ROL_COLOR_BADGE: Record<string, string> = {
  gerencia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  jefe_construccion: "bg-amber-50 text-amber-700 border-amber-200",
  jefe_mantencion: "bg-amber-50 text-amber-700 border-amber-200",
  coordinador: "bg-sky-50 text-sky-700 border-sky-200",
  bodega: "bg-orange-50 text-orange-700 border-orange-200",
  contabilidad: "bg-teal-50 text-teal-700 border-teal-200",
  desarrollo: "bg-violet-50 text-violet-700 border-violet-200",
  firmware: "bg-pink-50 text-pink-700 border-pink-200",
  tecnico: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

// Color sólido, usado en avatares circulares (Header).
export const ROL_COLOR_SOLIDO: Record<string, string> = {
  gerencia: "bg-emerald-600",
  jefe_construccion: "bg-amber-600",
  jefe_mantencion: "bg-amber-600",
  coordinador: "bg-sky-600",
  bodega: "bg-orange-500",
  contabilidad: "bg-teal-600",
  desarrollo: "bg-violet-600",
  firmware: "bg-pink-600",
  tecnico: "bg-zinc-600",
};

export function tieneRol(roles: string[] | undefined, nombre: string): boolean {
  return !!roles?.includes(nombre);
}

export function esGerencia(roles: string[] | undefined): boolean {
  return tieneRol(roles, "gerencia");
}

export function esJefatura(roles: string[] | undefined): boolean {
  return tieneRol(roles, "jefe_construccion") || tieneRol(roles, "jefe_mantencion");
}
