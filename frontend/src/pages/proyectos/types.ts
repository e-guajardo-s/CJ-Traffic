export type EstadoProyecto = "NO_INICIADO" | "EN_PROGRESO" | "PAUSADO" | "COMPLETADO" | "CANCELADO";
export type EstadoTarea = "POR_HACER" | "EN_PROGRESO" | "EN_REVISION" | "HECHO" | "BLOQUEADO";

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
  fechaCambioEstado: string | null;
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

export interface Tecnologia {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  archivos: ArchivoTecnico[];
  fechaCreacion: string;
}

export interface ComponenteStack {
  id: number;
  capa: 'HARDWARE' | 'RED' | 'PROCESAMIENTO' | 'VISUALIZACION';
  nombre: string;
  detalles: string | null;
  proyectoId: number;
}

export interface ArchivoTecnico {
  id: number;
  nombre: string;
  url: string;
  extension: string;
  tecnologiaId: number;
  fechaSubida: string;
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
  tareas?: { estado: EstadoTarea; updatedAt: string }[];
  _count?: { paginas: number };
  // Presentes solo en el detalle:
  paginas?: ProyectoPagina[];
  tecnologias?: Tecnologia[];
  componentesStack?: ComponenteStack[];
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
  BLOQUEADO: "Bloqueado",
};

export const COLUMNAS_KANBAN: EstadoTarea[] = ["POR_HACER", "EN_PROGRESO", "EN_REVISION", "HECHO", "BLOQUEADO"];

export const COLUMNA_KANBAN_ESTILO: Record<EstadoTarea, { fondo: string; borde: string; header: string; badge: string }> = {
  POR_HACER: { fondo: "bg-neutral-50/70", borde: "border-neutral-200", header: "text-neutral-500", badge: "bg-neutral-200 text-neutral-600" },
  EN_PROGRESO: { fondo: "bg-sky-50/60", borde: "border-sky-200", header: "text-sky-600", badge: "bg-sky-100 text-sky-700" },
  EN_REVISION: { fondo: "bg-amber-50/60", borde: "border-amber-200", header: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  HECHO: { fondo: "bg-emerald-50/60", borde: "border-emerald-200", header: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  BLOQUEADO: { fondo: "bg-red-50/60", borde: "border-red-200", header: "text-red-500", badge: "bg-red-100 text-red-600" },
};
