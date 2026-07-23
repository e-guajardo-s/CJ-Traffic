export interface Rol {
  id: number;
  nombre: string;
}

export interface Area {
  id: number;
  nombre: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  roles: string[];
  areas: string[];
}

export type TipoAviso = "INFO" | "MANTENCION" | "ADVERTENCIA" | "URGENTE";
export type PresentacionAviso = "BANNER" | "POPUP";
export type AudienciaAviso = "TODOS" | "AREA" | "ROL";

export interface Aviso {
  id: number;
  titulo: string;
  cuerpo: string;
  tipo: TipoAviso;
  presentacion: PresentacionAviso;
  audienciaTipo: AudienciaAviso;
  audienciaRef: string | null;
  fechaProgramada: string | null;
  vigenteHasta: string | null;
  activo: boolean;
  autor: { id: number; nombre: string };
  createdAt: string;
}
