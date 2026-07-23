import type { JwtPayload } from "./auth";

// Helpers de rol compartidos entre routers. Reciben `req.user` (JwtPayload)
// completo en vez de un solo `rolNombre`, porque desde el multi-rol un
// usuario puede calificar por cualquiera de sus roles (ej. Elías es
// "desarrollo" pero también aparece en tareas de mantención).
export function tieneRol(user: Pick<JwtPayload, "roles"> | undefined, nombre: string): boolean {
  return !!user?.roles?.includes(nombre);
}

export function esGerencia(user: Pick<JwtPayload, "roles"> | undefined): boolean {
  return tieneRol(user, "gerencia");
}

export function esJefatura(user: Pick<JwtPayload, "roles"> | undefined): boolean {
  return tieneRol(user, "jefe_construccion") || tieneRol(user, "jefe_mantencion");
}

export function puedeVerCostos(user: Pick<JwtPayload, "roles"> | undefined): boolean {
  return esGerencia(user) || esJefatura(user);
}

export function puedeAdministrarObra(user: Pick<JwtPayload, "roles"> | undefined): boolean {
  return esGerencia(user) || esJefatura(user);
}
