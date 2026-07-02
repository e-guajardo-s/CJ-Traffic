export type EstadoGateway = "ONLINE" | "OFFLINE" | "DEGRADADO";

export const ESTADO_GATEWAY_LABEL: Record<EstadoGateway, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  DEGRADADO: "Degradado",
};

export type TipoMantencion = "PREVENTIVA" | "CORRECTIVA" | "INSTALACION" | "RETIRO" | "OTRA";

export const TIPO_MANTENCION_LABEL: Record<TipoMantencion, string> = {
  PREVENTIVA: "Preventiva",
  CORRECTIVA: "Correctiva",
  INSTALACION: "Instalación",
  RETIRO: "Retiro",
  OTRA: "Otra",
};

export interface Mantencion {
  id: number;
  fecha: string;
  tipo: TipoMantencion;
  tecnico: string | null;
  notas: string | null;
  createdAt: string;
}

export interface Gateway {
  modelo: string | null;
  simApn: string | null;
  estado: EstadoGateway;
  fechaInstalacion: string | null;
  fechaDesinstalacion: string | null;
  enMantencion: boolean;
  mantenciones?: Mantencion[];
}

export interface UnidadAsignada {
  id: number;
  codigoUnidad: string;
  item: { nombre: string };
}

export interface Cruce {
  id: number;
  codigo: string;
  ubicacion: string;
  controlador: string;
  gateway: Gateway | null;
  unidadesAsignadas: UnidadAsignada[];
}

export type CategoriaCiclo = "verde" | "gris" | "sinInstalar" | "desinstalado";

// La mantención manda primero: si el cruce NO está en mantención, siempre es gris
// (no importa si tiene fechas o no — no está bajo seguimiento de instalación).
// Si SÍ está en mantención, se distingue entre:
//   verde        → tiene fecha de instalación y no ha sido desinstalado.
//   desinstalado → tiene fecha de desinstalación (tuvo instalación pero se retiró).
//   sinInstalar  → nunca se registró fecha de instalación.
export function categoriaCiclo(gateway: Gateway | null): CategoriaCiclo {
  if (!gateway || !gateway.enMantencion) return "gris";
  if (gateway.fechaDesinstalacion) return "desinstalado";
  if (!gateway.fechaInstalacion) return "sinInstalar";
  return "verde";
}

export const CATEGORIA_LABEL: Record<CategoriaCiclo, string> = {
  verde: "En mantención",
  gris: "Sin mantención",
  sinInstalar: "Sin instalar",
  desinstalado: "Desinstalado",
};
