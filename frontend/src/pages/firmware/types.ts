export type EstadoProgramacion = "EN_COLA" | "EN_PRUEBA" | "APROBADO" | "RECHAZADO";

export interface Programacion {
  id: number;
  version: string;
  archivoNombre: string;
  estado: EstadoProgramacion;
  cruce: { codigo: string; ubicacion: string };
  subidoPor: { nombre: string };
  feedbacks: { id: number; comentario: string; aprobado: boolean }[];
}
