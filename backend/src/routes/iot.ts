import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const iotRouter = Router();

// Orden natural: compara tramos numéricos como número (2 < 10) en vez de texto
// (donde "10" < "2"), y el resto como texto. Soporta tanto códigos puramente
// numéricos ("1", "10") como con prefijo ("CRX-001", "CRX-010").
function compararNatural(a: string, b: string): number {
  const partsA = a.match(/\d+|\D+/g) ?? [];
  const partsB = b.match(/\d+|\D+/g) ?? [];
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? "";
    const pb = partsB[i] ?? "";
    if (pa === pb) continue;
    const na = Number(pa);
    const nb = Number(pb);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && pa.trim() !== "" && pb.trim() !== "") return na - nb;
    return pa < pb ? -1 : 1;
  }
  return 0;
}

// Directorio de gateways: solo cruces que efectivamente tienen un gateway de
// monitoreo registrado. Un cruce sin gateway (nunca tuvo uno, o se eliminó) no
// es asunto de este directorio — puede seguir existiendo para el firmware.
iotRouter.get("/gateways", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const cruces = await prisma.cruce.findMany({
    where: { gateway: { isNot: null } },
    include: { gateway: true, unidadesAsignadas: { include: { item: true } } },
  });
  cruces.sort((a, b) => compararNatural(a.codigo, b.codigo));
  res.json(cruces);
});

const ESTADOS_VALIDOS = ["ONLINE", "OFFLINE", "DEGRADADO"] as const;

function parseFecha(valor: unknown): Date | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const fecha = new Date(valor as string);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

iotRouter.patch("/gateways/:cruceId", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const cruceId = Number(req.params.cruceId);
  const { ubicacion, controlador, modelo, simApn, estado, fechaInstalacion, fechaDesinstalacion, enMantencion } = req.body ?? {};

  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
  }

  const anterior = await prisma.gatewayIot.findUnique({ where: { cruceId } });
  if (!anterior) return res.status(404).json({ error: "Gateway no encontrado para ese cruce" });

  const [cruce, actualizado] = await prisma.$transaction([
    prisma.cruce.update({
      where: { id: cruceId },
      data: {
        ...(ubicacion !== undefined ? { ubicacion } : {}),
        ...(controlador !== undefined ? { controlador } : {}),
      },
    }),
    prisma.gatewayIot.update({
      where: { cruceId },
      data: {
        ...(modelo !== undefined ? { modelo } : {}),
        ...(simApn !== undefined ? { simApn } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(fechaInstalacion !== undefined ? { fechaInstalacion: parseFecha(fechaInstalacion) } : {}),
        ...(fechaDesinstalacion !== undefined ? { fechaDesinstalacion: parseFecha(fechaDesinstalacion) } : {}),
        ...(enMantencion !== undefined ? { enMantencion: Boolean(enMantencion) } : {}),
      },
    }),
  ]);

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "gateway.actualizar",
    entidad: "GatewayIot",
    entidadId: actualizado.id,
    detalle: { anterior, nuevo: actualizado },
  });

  res.json({ ...cruce, gateway: actualizado });
});

iotRouter.post("/cruces", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { codigo, ubicacion, controlador, modelo, estado, fechaInstalacion, fechaDesinstalacion, enMantencion } = req.body ?? {};

  if (!codigo || !ubicacion || !controlador) {
    return res.status(400).json({ error: "codigo, ubicacion y controlador son requeridos" });
  }
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
  }

  const existente = await prisma.cruce.findUnique({ where: { codigo } });
  if (existente) return res.status(409).json({ error: "Ya existe un cruce con ese código" });

  const cruce = await prisma.cruce.create({
    data: {
      codigo,
      ubicacion,
      controlador,
      gateway: {
        create: {
          modelo: modelo || null,
          estado: estado ?? "OFFLINE",
          fechaInstalacion: parseFecha(fechaInstalacion) ?? null,
          fechaDesinstalacion: parseFecha(fechaDesinstalacion) ?? null,
          enMantencion: Boolean(enMantencion),
        },
      },
    },
    include: { gateway: true },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "cruce.crear",
    entidad: "Cruce",
    entidadId: cruce.id,
    detalle: { cruce },
  });

  res.status(201).json(cruce);
});

// El Directorio de Gateways administra equipos de monitoreo IoT, sin trabas.
// Si el cruce no tiene historial de firmware, se elimina completo (el código
// queda libre para reutilizarse). Si sí tiene historial (sistema independiente
// de controladores), la integridad referencial impide borrar el Cruce, así que
// solo se retira el gateway — mismo resultado desde la UI, sin errores visibles.
iotRouter.delete("/cruces/:cruceId", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const cruceId = Number(req.params.cruceId);

  const cruce = await prisma.cruce.findUnique({
    where: { id: cruceId },
    include: { gateway: true, programaciones: { select: { id: true } } },
  });
  if (!cruce) return res.status(404).json({ error: "Cruce no encontrado" });
  if (!cruce.gateway) return res.status(404).json({ error: "Este cruce no tiene gateway de monitoreo registrado" });

  await prisma.gatewayIot.delete({ where: { cruceId } });

  if (cruce.programaciones.length === 0) {
    await prisma.cruce.delete({ where: { id: cruceId } });
    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "cruce.eliminar",
      entidad: "Cruce",
      entidadId: cruceId,
      detalle: { cruce },
    });
  } else {
    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "gateway.eliminar",
      entidad: "GatewayIot",
      entidadId: cruce.gateway.id,
      detalle: { cruce },
    });
  }

  res.status(204).send();
});
