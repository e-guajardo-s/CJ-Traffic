export type EstadoProyecto = "NO_INICIADO" | "EN_PROGRESO" | "PAUSADO" | "COMPLETADO" | "CANCELADO";
export type EstadoTarea = "POR_HACER" | "EN_PROGRESO" | "EN_REVISION" | "HECHO";

export interface UsuarioLite {
  id: number;
  nombre: string;
}

export interface ProyectoTarea {
  id: number;
  proyectoId: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  orden: number;
  asignado: UsuarioLite | null;
  asignadoId: number | null;
  fechaLimite: string | null;
  createdAt: string;
}

export interface ProyectoPagina {
  id: number;
  proyectoId: number;
  titulo: string;
  contenido: string;
  orden: number;
  autor: UsuarioLite;
  createdAt: string;
  updatedAt: string;
}

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoProyecto;
  fechaInicio: string | null;
  fechaFin: string | null;
  responsable: UsuarioLite | null;
  responsableId: number | null;
  createdAt: string;
  updatedAt: string;
  // Presentes solo en el listado (resumen liviano):
  tareas?: { estado: EstadoTarea }[];
  _count?: { paginas: number };
  // Presentes solo en el detalle:
  paginas?: ProyectoPagina[];
}

export const ESTADO_PROYECTO_LABEL: Record<EstadoProyecto, string> = {
  NO_INICIADO: "No iniciado",
  EN_PROGRESO: "En progreso",
  PAUSADO: "Pausado",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

export const ESTADO_PROYECTO_COLOR: Record<EstadoProyecto, string> = {
  NO_INICIADO: "text-neutral-600 bg-neutral-100 border-neutral-200",
  EN_PROGRESO: "text-sky-700 bg-sky-50 border-sky-200",
  PAUSADO: "text-amber-700 bg-amber-50 border-amber-200",
  COMPLETADO: "text-emerald-700 bg-emerald-50 border-emerald-200",
  CANCELADO: "text-red-700 bg-red-50 border-red-200",
};

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  POR_HACER: "Por hacer",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  HECHO: "Hecho",
};

export const COLUMNAS_KANBAN: EstadoTarea[] = ["POR_HACER", "EN_PROGRESO", "EN_REVISION", "HECHO"];
