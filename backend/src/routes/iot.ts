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
    include: {
      gateway: { include: { mantenciones: { orderBy: { fecha: "desc" } } } },
      unidadesAsignadas: { include: { item: true } },
    },
  });
  cruces.sort((a, b) => compararNatural(a.codigo, b.codigo));
  res.json(cruces);
});

// Dashboard del área de Desarrollo: consolida en una sola llamada el estado de
// gateways, alertas operativas, actividad reciente y trabajo pendiente.
iotRouter.get("/dashboard", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const hoy = new Date();

  const [gateways, actividad, tareasPendientes, items, proyectos] = await Promise.all([
    prisma.gatewayIot.findMany({
      include: { cruce: { select: { id: true, codigo: true, ubicacion: true } } },
    }),
    prisma.bitacoraEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { autor: { select: { id: true, nombre: true } } },
    }),
    prisma.proyectoTarea.findMany({
      where: { estado: { not: "HECHO" }, proyecto: { estado: { in: ["NO_INICIADO", "EN_PROGRESO"] } } },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        asignado: { select: { id: true, nombre: true } },
      },
      orderBy: [{ fechaLimite: { sort: "asc", nulls: "last" } }, { orden: "asc" }],
      take: 20,
    }),
    prisma.itemInventario.findMany({ include: { unidades: true } }),
    prisma.proyecto.findMany({ select: { estado: true } }),
  ]);

  const conteoGateways = { total: gateways.length, online: 0, offline: 0, degradado: 0 };
  const gatewaysConProblemas: { cruceId: number; codigo: string; ubicacion: string; estado: string }[] = [];
  for (const gw of gateways) {
    if (gw.estado === "ONLINE") conteoGateways.online++;
    else if (gw.estado === "OFFLINE") conteoGateways.offline++;
    else conteoGateways.degradado++;
    if (gw.estado !== "ONLINE") {
      gatewaysConProblemas.push({ cruceId: gw.cruce.id, codigo: gw.cruce.codigo, ubicacion: gw.cruce.ubicacion, estado: gw.estado });
    }
  }

  // Stock bajo: unidades en circulación (no de baja, no asignadas) bajo el umbral mínimo.
  const stockBajo = items
    .map((i) => {
      const disponibles = i.unidades.filter((u) => !u.dadaDeBaja && !u.cruceId).length;
      return { id: i.id, nombre: i.nombre, disponibles, umbralMinimo: i.umbralMinimo };
    })
    .filter((i) => i.umbralMinimo > 0 && i.disponibles <= i.umbralMinimo);

  const tareasVencidas = tareasPendientes.filter((t) => t.fechaLimite && new Date(t.fechaLimite) < hoy);

  res.json({
    gateways: conteoGateways,
    gatewaysConProblemas,
    actividad,
    tareas: {
      pendientes: tareasPendientes.length,
      vencidas: tareasVencidas.length,
      proximas: tareasPendientes.slice(0, 6),
    },
    stockBajo,
    proyectos: {
      total: proyectos.length,
      enProgreso: proyectos.filter((p) => p.estado === "EN_PROGRESO").length,
    },
  });
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

// ───────────────────────── Historial de mantenciones ─────────────────────────

const TIPOS_MANTENCION = ["PREVENTIVA", "CORRECTIVA", "INSTALACION", "RETIRO", "OTRA"] as const;

iotRouter.get("/gateways/:cruceId/mantenciones", requireAuth, requireModulo("iot", "LECTURA"), async (req, res) => {
  const cruceId = Number(req.params.cruceId);
  const gateway = await prisma.gatewayIot.findUnique({ where: { cruceId } });
  if (!gateway) return res.status(404).json({ error: "Gateway no encontrado para ese cruce" });

  const mantenciones = await prisma.mantencionGateway.findMany({
    where: { gatewayId: gateway.id },
    orderBy: { fecha: "desc" },
  });
  res.json(mantenciones);
});

iotRouter.post("/gateways/:cruceId/mantenciones", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const cruceId = Number(req.params.cruceId);
  const { fecha, tipo, tecnico, notas } = req.body ?? {};

  if (!fecha) return res.status(400).json({ error: "fecha es requerida" });
  const fechaParsed = parseFecha(fecha);
  if (!fechaParsed) return res.status(400).json({ error: "fecha inválida" });
  if (tipo !== undefined && !TIPOS_MANTENCION.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_MANTENCION.join(", ")}` });
  }

  const gateway = await prisma.gatewayIot.findUnique({ where: { cruceId }, include: { cruce: true } });
  if (!gateway) return res.status(404).json({ error: "Gateway no encontrado para ese cruce" });

  const mantencion = await prisma.mantencionGateway.create({
    data: {
      gatewayId: gateway.id,
      fecha: fechaParsed,
      tipo: tipo ?? "PREVENTIVA",
      tecnico: tecnico?.trim() || null,
      notas: notas?.trim() || null,
    },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "gateway.mantencion.registrar",
    entidad: "MantencionGateway",
    entidadId: mantencion.id,
    detalle: { cruce: gateway.cruce.codigo, tipo: mantencion.tipo, fecha: mantencion.fecha },
  });

  res.status(201).json(mantencion);
});

iotRouter.delete("/mantenciones/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const mantencion = await prisma.mantencionGateway.findUnique({ where: { id } });
  if (!mantencion) return res.status(404).json({ error: "Mantención no encontrada" });

  await prisma.mantencionGateway.delete({ where: { id } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "gateway.mantencion.eliminar",
    entidad: "MantencionGateway",
    entidadId: id,
    detalle: { gatewayId: mantencion.gatewayId, tipo: mantencion.tipo, fecha: mantencion.fecha },
  });

  res.status(204).send();
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
