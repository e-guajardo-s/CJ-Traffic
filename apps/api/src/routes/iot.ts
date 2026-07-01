import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const iotRouter = Router();

iotRouter.get("/gateways", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const cruces = await prisma.cruce.findMany({
    include: { gateway: true },
    orderBy: { codigo: "asc" },
  });
  res.json(cruces);
});

const ESTADOS_VALIDOS = ["ONLINE", "OFFLINE", "DEGRADADO"] as const;

iotRouter.patch("/gateways/:cruceId", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const cruceId = Number(req.params.cruceId);
  const { modelo, simApn, estado } = req.body ?? {};

  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
  }

  const anterior = await prisma.gatewayIot.findUnique({ where: { cruceId } });
  if (!anterior) return res.status(404).json({ error: "Gateway no encontrado para ese cruce" });

  const actualizado = await prisma.gatewayIot.update({
    where: { cruceId },
    data: {
      ...(modelo !== undefined ? { modelo } : {}),
      ...(simApn !== undefined ? { simApn } : {}),
      ...(estado !== undefined ? { estado } : {}),
    },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "gateway.actualizar",
    entidad: "GatewayIot",
    entidadId: actualizado.id,
    detalle: { anterior, nuevo: actualizado },
  });

  res.json(actualizado);
});
