import { prisma } from "./prisma";

export function registrarBitacora(params: {
  autorId: number;
  accion: string;
  entidad: string;
  entidadId: number;
  detalle: Record<string, unknown>;
}) {
  return prisma.bitacoraEntry.create({ data: params });
}
