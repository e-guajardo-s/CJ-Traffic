import { Router } from "express";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { parseEstadoPagoXls } from "../lib/parseEstadoPago";
import type { JwtPayload } from "../auth";
import { puedeAdministrarObra, puedeVerCostos, tieneRol } from "../rbac";

export const subcontratosRouter = Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const usuarioLite = { select: { id: true, nombre: true } };

// Editar precios o agregar ítems de presupuesto: gerencia/jefatura en
// cualquier obra, o el rol "coordinador" pero SOLO en la obra que tiene
// asignada (`obra.coordinadorId`) — mismo criterio que PATCH /proyectos-empresa/:id.
function puedeEditarPartidas(user: JwtPayload | undefined, obraCoordinadorId: number | null | undefined) {
  if (puedeAdministrarObra(user)) return true;
  return tieneRol(user, "coordinador") && obraCoordinadorId != null && obraCoordinadorId === user?.sub;
}

// Redacta a `null` (no se elimina la clave) para no romper los `Number(...)`
// sin guarda del frontend, que interpretan `null` como 0 de forma segura.
// `archivoUrl` también se redacta: el Excel original contiene los mismos
// montos y es un link estático sin control de acceso propio.
// `mostrarPreciosPartidas`: excepción puntual para el coordinador asignado,
// que puede ver/editar precioUnitario/total de cada ítem (no el resto de
// montos del subcontrato/EP, que siguen redactados).
function redactarCostosSubcontrato<T extends {
  montoContrato: unknown;
  montoAnticipo: unknown;
  estadosPago: any[];
  partidas?: any[];
}>(s: T, mostrarPreciosPartidas = false): T {
  return {
    ...s,
    montoContrato: null,
    montoAnticipo: null,
    estadosPago: s.estadosPago.map((ep) => ({
      ...ep,
      montoEp: null,
      subtotal: null,
      devAnticipo: null,
      retencion: null,
      montoNeto: null,
      iva: null,
      totalPagar: null,
      archivoUrl: null,
    })),
    ...(s.partidas
      ? {
          partidas: s.partidas.map((p) => ({
            ...p,
            precioUnitario: mostrarPreciosPartidas ? p.precioUnitario : null,
            total: mostrarPreciosPartidas ? p.total : null,
            avances: p.avances?.map((a: any) => ({ ...a, montoAcumulado: null, montoAnterior: null, montoActual: null })),
          })),
        }
      : {}),
  };
}

function redactarEp<T extends { montoEp: unknown; archivoUrl?: unknown }>(ep: T): T {
  return { ...ep, montoEp: null, subtotal: null, devAnticipo: null, retencion: null, montoNeto: null, iva: null, totalPagar: null, archivoUrl: null } as T;
}

const includeSubcontrato = {
  obra: { select: { id: true, nombre: true, coordinadorId: true } },
  estadosPago: { orderBy: { fechaEp: "desc" as const } },
  partidas: { orderBy: { orden: "asc" as const }, include: { avances: true } },
};

// GET /subcontratos - Lista transversal o filtrada por obraId
subcontratosRouter.get("/", requireAuth, async (req, res) => {
  const { obraId } = req.query;
  const whereClause = obraId ? { obraId: Number(obraId) } : {};

  const subcontratos = await prisma.subcontrato.findMany({
    where: whereClause,
    include: includeSubcontrato,
    orderBy: { createdAt: "desc" }
  });

  if (puedeVerCostos(req.user)) return res.json(subcontratos);
  res.json(subcontratos.map((s) =>
    redactarCostosSubcontrato(s, puedeEditarPartidas(req.user, s.obra.coordinadorId))
  ));
});

// POST /subcontratos - Crear subcontrato
subcontratosRouter.post("/", requireAuth, async (req, res) => {
  const { obraId, especialidad, empresa, montoContrato, avanceReal, observaciones } = req.body ?? {};

  if (!obraId || !especialidad || !empresa || montoContrato === undefined) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const subcontrato = await prisma.subcontrato.create({
    data: {
      obraId: Number(obraId),
      especialidad: String(especialidad),
      empresa: String(empresa),
      montoContrato: Number(montoContrato),
      avanceReal: Number(avanceReal || 0),
      observaciones: observaciones ? String(observaciones) : null,
    },
    include: { obra: { select: { nombre: true } }, estadosPago: true }
  });

  res.status(201).json(puedeVerCostos(req.user) ? subcontrato : redactarCostosSubcontrato(subcontrato));
});

// PATCH /subcontratos/:id - Editar observaciones de un subcontrato. El "plan"
// de un contrato siempre es 100% (no hay curva planificada aparte); el avance
// real se sigue por Estado de Pago, no se edita acá.
subcontratosRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { observaciones } = req.body ?? {};

  const existente = await prisma.subcontrato.findUnique({ where: { id }, include: { obra: { select: { coordinadorId: true } } } });
  if (!existente) return res.status(404).json({ error: "Subcontrato no encontrado" });

  const subcontrato = await prisma.subcontrato.update({
    where: { id },
    data: {
      ...(observaciones !== undefined ? { observaciones: observaciones ? String(observaciones) : null } : {}),
    },
    include: includeSubcontrato,
  });

  if (puedeVerCostos(req.user)) return res.json(subcontrato);
  res.json(redactarCostosSubcontrato(subcontrato, puedeEditarPartidas(req.user, existente.obra.coordinadorId)));
});

// POST /subcontratos/importar - Importa un Estado de Pago desde el Excel de
// Javiera (carátula + detalle por partidas). Encuentra o crea el subcontrato
// (misma empresa + N° OC dentro de la obra); el presupuesto por partidas se
// crea una sola vez y los EP siguientes solo agregan su avance por partida.
subcontratosRouter.post("/importar", requireAuth, async (req, res) => {
  const { obraId, archivoBase64, nombreArchivo, estado } = req.body ?? {};
  if (!obraId || !archivoBase64 || !nombreArchivo) {
    return res.status(400).json({ error: "obraId, archivoBase64 y nombreArchivo son requeridos" });
  }

  const obra = await prisma.obra.findUnique({ where: { id: Number(obraId) } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const buffer = Buffer.from(archivoBase64, "base64");
  let parsed: ReturnType<typeof parseEstadoPagoXls>;
  try {
    parsed = parseEstadoPagoXls(buffer);
  } catch (e: any) {
    return res.status(400).json({ error: `No se pudo leer el Estado de Pago: ${e.message}` });
  }

  const estadoFinal = estado ? String(estado) : "EN REVISIÓN";

  // Busca un subcontrato existente por empresa + especialidad dentro de la
  // misma obra. Si coinciden, los EPs se agrupan en el mismo subcontrato.
  let subcontrato = await prisma.subcontrato.findFirst({
    where: { obraId: Number(obraId), empresa: parsed.subcontrato.empresa, especialidad: parsed.subcontrato.especialidad },
    include: { partidas: { orderBy: { orden: "asc" } } },
  });

  if (!subcontrato) {
    subcontrato = await prisma.subcontrato.create({
      data: {
        obraId: Number(obraId),
        especialidad: parsed.subcontrato.especialidad,
        empresa: parsed.subcontrato.empresa,
        numeroOc: parsed.subcontrato.numeroOc,
        montoContrato: parsed.subcontrato.montoContrato,
        montoAnticipo: parsed.subcontrato.montoAnticipo,
        devAnticipoPct: parsed.subcontrato.devAnticipoPct,
        retencionPct: parsed.subcontrato.retencionPct,
        ivaPct: parsed.subcontrato.ivaPct,
        partidas: {
          create: parsed.partidas.map((p) => ({
            orden: p.orden,
            esCapitulo: p.esCapitulo,
            itemNumero: p.itemNumero,
            descripcion: p.descripcion,
            unidad: p.unidad,
            cantidad: p.cantidad,
            precioUnitario: p.precioUnitario,
            total: p.total,
          })),
        },
      },
      include: { partidas: { orderBy: { orden: "asc" } } },
    });
  }

  const yaExiste = await prisma.estadoPago.findFirst({ where: { subcontratoId: subcontrato.id, numeroEp: parsed.ep.numeroEp } });
  if (yaExiste) {
    return res.status(409).json({ error: `Ya existe un Estado de Pago ${parsed.ep.numeroEp} para este subcontrato.` });
  }

  const extension = String(nombreArchivo).split(".").pop() || "xls";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);
  const archivoUrl = `/uploads/${uniqueName}`;

  const ep = await prisma.estadoPago.create({
    data: {
      subcontratoId: subcontrato.id,
      numeroEp: parsed.ep.numeroEp,
      fechaEp: parsed.ep.fechaEp,
      emisor: parsed.ep.emisor,
      montoEp: parsed.ep.totalPagar,
      subtotal: parsed.ep.subtotal,
      devAnticipo: parsed.ep.devAnticipo,
      retencion: parsed.ep.retencion,
      montoNeto: parsed.ep.montoNeto,
      iva: parsed.ep.iva,
      totalPagar: parsed.ep.totalPagar,
      avanceAcumuladoPct: parsed.ep.avanceAcumuladoPct,
      estado: estadoFinal,
      archivoUrl,
    },
  });

  // Vincula el avance de cada partida importada con la partida existente
  // (por orden — misma estructura de presupuesto en cada EP del subcontrato).
  for (const p of parsed.partidas) {
    if (!p.avance) continue;
    const partidaExistente = subcontrato.partidas.find((x) => x.orden === p.orden);
    if (!partidaExistente) continue;
    await prisma.avancePartidaEP.create({
      data: {
        estadoPagoId: ep.id,
        partidaId: partidaExistente.id,
        avanceAcumuladoPct: p.avance.avanceAcumuladoPct,
        avanceAnteriorPct: p.avance.avanceAnteriorPct,
        avanceActualPct: p.avance.avanceActualPct,
        montoAcumulado: p.avance.montoAcumulado,
        montoAnterior: p.avance.montoAnterior,
        montoActual: p.avance.montoActual,
      },
    });
  }

  await prisma.subcontrato.update({
    where: { id: subcontrato.id },
    data: { avanceReal: Math.round(parsed.ep.avanceAcumuladoPct * 100) },
  });

  if (estadoFinal === "PAGADO") {
    await prisma.obra.update({ where: { id: Number(obraId) }, data: { costoAcumulado: { increment: parsed.ep.totalPagar } } });
  }

  const actualizado = await prisma.subcontrato.findUnique({ where: { id: subcontrato.id }, include: includeSubcontrato });
  if (puedeVerCostos(req.user)) return res.status(201).json(actualizado);
  res.status(201).json(redactarCostosSubcontrato(actualizado!, puedeEditarPartidas(req.user, actualizado!.obra.coordinadorId)));
});

// PATCH /subcontratos/partidas/:id - Editar un ítem de presupuesto (precio,
// cantidad, descripción...). Gerencia/jefatura o el coordinador asignado a la
// obra del subcontrato (ver puedeEditarPartidas). Cada cambio de precio o
// cantidad queda auditado en la bitácora de la obra.
subcontratosRouter.patch("/partidas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { descripcion, unidad, cantidad, precioUnitario, itemNumero } = req.body ?? {};

  const partida = await prisma.partidaPresupuesto.findUnique({
    where: { id },
    include: { subcontrato: { include: { obra: { select: { id: true, coordinadorId: true } } } } },
  });
  if (!partida) return res.status(404).json({ error: "Ítem no encontrado" });

  if (!puedeEditarPartidas(req.user, partida.subcontrato.obra.coordinadorId)) {
    return res.status(403).json({ error: "No tienes permisos para editar ítems de presupuesto" });
  }

  const cantidadAnterior = partida.cantidad != null ? Number(partida.cantidad) : null;
  const precioAnterior = partida.precioUnitario != null ? Number(partida.precioUnitario) : null;
  const nuevaCantidad = cantidad !== undefined ? Number(cantidad) : cantidadAnterior;
  const nuevoPrecio = precioUnitario !== undefined ? Number(precioUnitario) : precioAnterior;
  // El total se recalcula solo si cambia precio o cantidad, para no pisar un
  // total importado del Excel cuando solo se edita la descripción.
  const cambioMonto = cantidad !== undefined || precioUnitario !== undefined;
  const nuevoTotal = cambioMonto && !partida.esCapitulo && nuevaCantidad != null && nuevoPrecio != null
    ? nuevaCantidad * nuevoPrecio
    : partida.total != null ? Number(partida.total) : null;

  const actualizada = await prisma.partidaPresupuesto.update({
    where: { id },
    data: {
      ...(descripcion !== undefined ? { descripcion: String(descripcion) } : {}),
      ...(unidad !== undefined ? { unidad: unidad ? String(unidad) : null } : {}),
      ...(itemNumero !== undefined ? { itemNumero: itemNumero ? String(itemNumero) : null } : {}),
      ...(cantidad !== undefined ? { cantidad: nuevaCantidad } : {}),
      ...(cambioMonto ? { precioUnitario: nuevoPrecio, total: nuevoTotal } : {}),
    },
  });

  if (cambioMonto) {
    await prisma.obraBitacora.create({
      data: {
        obraId: partida.subcontrato.obra.id,
        autorId: req.user!.sub,
        tipoEvento: "PARTIDA_EDITADA",
        mensaje: `Ítem "${actualizada.descripcion}" (subcontrato "${partida.subcontrato.empresa}") editado: precio ${precioAnterior?.toLocaleString("es-CL") ?? "—"} → ${nuevoPrecio?.toLocaleString("es-CL") ?? "—"}, cantidad ${cantidadAnterior ?? "—"} → ${nuevaCantidad ?? "—"}.`,
      },
    });
  }

  res.json(actualizada);
});

// POST /subcontratos/:id/partidas - Agregar un ítem de presupuesto nuevo (no
// venía en el Excel importado originalmente). Mismo gate que editar partidas.
subcontratosRouter.post("/:id/partidas", requireAuth, async (req, res) => {
  const subcontratoId = Number(req.params.id);
  const { descripcion, unidad, cantidad, precioUnitario, itemNumero, esCapitulo } = req.body ?? {};
  if (!descripcion) return res.status(400).json({ error: "descripcion es requerida" });

  const subcontrato = await prisma.subcontrato.findUnique({
    where: { id: subcontratoId },
    include: { obra: { select: { id: true, coordinadorId: true } }, partidas: { select: { orden: true } } },
  });
  if (!subcontrato) return res.status(404).json({ error: "Subcontrato no encontrado" });

  if (!puedeEditarPartidas(req.user, subcontrato.obra.coordinadorId)) {
    return res.status(403).json({ error: "No tienes permisos para agregar ítems de presupuesto" });
  }

  const esCap = Boolean(esCapitulo);
  const cant = !esCap && cantidad !== undefined && cantidad !== null && cantidad !== "" ? Number(cantidad) : null;
  const precio = !esCap && precioUnitario !== undefined && precioUnitario !== null && precioUnitario !== "" ? Number(precioUnitario) : null;
  const total = cant != null && precio != null ? cant * precio : null;
  const maxOrden = subcontrato.partidas.reduce((m, p) => Math.max(m, p.orden), -1);

  const partida = await prisma.partidaPresupuesto.create({
    data: {
      subcontratoId,
      orden: maxOrden + 1,
      esCapitulo: esCap,
      itemNumero: itemNumero ? String(itemNumero) : null,
      descripcion: String(descripcion),
      unidad: esCap ? null : (unidad ? String(unidad) : null),
      cantidad: cant,
      precioUnitario: precio,
      total,
    },
  });

  await prisma.obraBitacora.create({
    data: {
      obraId: subcontrato.obra.id,
      autorId: req.user!.sub,
      tipoEvento: "PARTIDA_AGREGADA",
      mensaje: `Ítem agregado al subcontrato "${subcontrato.empresa}": "${partida.descripcion}"${total != null ? ` (${total.toLocaleString("es-CL")})` : ""}.`,
    },
  });

  res.status(201).json(partida);
});

// GET /subcontratos/:id/exportar-excel - Genera un .xlsx estandarizado con el
// presupuesto de partidas vigente (incluye ítems editados/agregados a mano,
// no solo lo importado del Excel original). No reescribe el archivo del EP
// importado, es un documento de respaldo nuevo generado bajo demanda.
subcontratosRouter.get("/:id/exportar-excel", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const subcontrato = await prisma.subcontrato.findUnique({
    where: { id },
    include: { obra: { select: { coordinadorId: true } }, partidas: { orderBy: { orden: "asc" } } },
  });
  if (!subcontrato) return res.status(404).json({ error: "Subcontrato no encontrado" });

  if (!puedeVerCostos(req.user) && !puedeEditarPartidas(req.user, subcontrato.obra.coordinadorId)) {
    return res.status(403).json({ error: "No tienes permisos para exportar el presupuesto de este subcontrato" });
  }

  const filas = [
    ["Item", "Descripción", "Unidad", "Cantidad", "Precio Unitario", "Total"],
    ...subcontrato.partidas.map((p) => [
      p.itemNumero ?? "",
      p.descripcion,
      p.unidad ?? "",
      p.cantidad != null ? Number(p.cantidad) : "",
      p.precioUnitario != null ? Number(p.precioUnitario) : "",
      p.total != null ? Number(p.total) : "",
    ]),
  ];

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Detalle EP");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });

  const nombreArchivo = `Presupuesto_${subcontrato.empresa.replace(/[^a-zA-Z0-9]+/g, "_")}_${subcontrato.id}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
  res.send(buffer);
});

// POST /subcontratos/:id/ep - Crear EP
subcontratosRouter.post("/:id/ep", requireAuth, async (req, res) => {
  const subcontratoId = Number(req.params.id);
  const { numeroEp, fechaEp, montoEp, estado, observaciones } = req.body ?? {};

  if (!numeroEp || !fechaEp || montoEp === undefined || !estado) {
    return res.status(400).json({ error: "Faltan campos obligatorios para el EP" });
  }

  const subcontrato = await prisma.subcontrato.findUnique({ where: { id: subcontratoId } });
  if (!subcontrato) return res.status(404).json({ error: "Subcontrato no encontrado" });

  const ep = await prisma.estadoPago.create({
    data: {
      subcontratoId,
      numeroEp: String(numeroEp),
      fechaEp: new Date(fechaEp),
      montoEp: Number(montoEp),
      estado: String(estado),
      observaciones: observaciones ? String(observaciones) : null,
    }
  });

  // Si el estado es PAGADO, sumamos el monto al costoAcumulado de la obra
  if (estado === "PAGADO") {
    await prisma.obra.update({
      where: { id: subcontrato.obraId },
      data: { costoAcumulado: { increment: Number(montoEp) } }
    });
  }

  res.status(201).json(puedeVerCostos(req.user) ? ep : redactarEp(ep));
});

// PATCH /subcontratos/ep/:epId - Actualizar EP
subcontratosRouter.patch("/ep/:epId", requireAuth, async (req, res) => {
  const epId = Number(req.params.epId);
  const { estado } = req.body ?? {};

  if (!estado) return res.status(400).json({ error: "Falta el estado" });

  const ep = await prisma.estadoPago.findUnique({
    where: { id: epId },
    include: { subcontrato: true }
  });
  if (!ep) return res.status(404).json({ error: "EP no encontrado" });

  const nuevoEp = await prisma.estadoPago.update({
    where: { id: epId },
    data: { estado: String(estado) }
  });

  // Si pasa a PAGADO y antes no lo estaba, suma al costo
  if (estado === "PAGADO" && ep.estado !== "PAGADO") {
    await prisma.obra.update({
      where: { id: ep.subcontrato.obraId },
      data: { costoAcumulado: { increment: Number(ep.montoEp) } }
    });
  } else if (estado !== "PAGADO" && ep.estado === "PAGADO") {
    // Si deja de estar PAGADO, resta del costo
    await prisma.obra.update({
      where: { id: ep.subcontrato.obraId },
      data: { costoAcumulado: { decrement: Number(ep.montoEp) } }
    });
  }

  res.json(puedeVerCostos(req.user) ? nuevoEp : redactarEp(nuevoEp));
});

// DELETE /subcontratos/ep/:epId - Eliminar un Estado de Pago (revierte el
// costo acumulado si estaba PAGADO). Solo jefatura/gerencia.
subcontratosRouter.delete("/ep/:epId", requireAuth, async (req, res) => {
  if (!puedeAdministrarObra(req.user)) {
    return res.status(403).json({ error: "Solo jefatura o gerencia puede eliminar un Estado de Pago" });
  }
  const epId = Number(req.params.epId);
  const ep = await prisma.estadoPago.findUnique({ where: { id: epId }, include: { subcontrato: true } });
  if (!ep) return res.status(404).json({ error: "EP no encontrado" });

  if (ep.estado === "PAGADO") {
    await prisma.obra.update({
      where: { id: ep.subcontrato.obraId },
      data: { costoAcumulado: { decrement: Number(ep.montoEp) } },
    });
  }

  if (ep.archivoUrl) {
    const filePath = path.join(UPLOADS_DIR, path.basename(ep.archivoUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await prisma.estadoPago.delete({ where: { id: epId } }); // cascada: AvancePartidaEP
  res.status(204).send();
});

// DELETE /subcontratos/:id - Eliminar un subcontrato completo (cascada de EP,
// partidas y avances). Revierte el costo acumulado de los EP que estaban
// PAGADO. Solo jefatura/gerencia.
subcontratosRouter.delete("/:id", requireAuth, async (req, res) => {
  if (!puedeAdministrarObra(req.user)) {
    return res.status(403).json({ error: "Solo jefatura o gerencia puede eliminar un subcontrato" });
  }
  const id = Number(req.params.id);
  const subcontrato = await prisma.subcontrato.findUnique({ where: { id }, include: { estadosPago: true } });
  if (!subcontrato) return res.status(404).json({ error: "Subcontrato no encontrado" });

  const montoPagado = subcontrato.estadosPago
    .filter((ep) => ep.estado === "PAGADO")
    .reduce((s, ep) => s + Number(ep.montoEp), 0);
  if (montoPagado > 0) {
    await prisma.obra.update({ where: { id: subcontrato.obraId }, data: { costoAcumulado: { decrement: montoPagado } } });
  }

  for (const ep of subcontrato.estadosPago) {
    if (!ep.archivoUrl) continue;
    const filePath = path.join(UPLOADS_DIR, path.basename(ep.archivoUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await prisma.subcontrato.delete({ where: { id } }); // cascada: EstadoPago, PartidaPresupuesto, AvancePartidaEP
  res.status(204).send();
});
