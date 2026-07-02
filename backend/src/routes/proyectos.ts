import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const proyectosRouter = Router();

const usuarioLite = { select: { id: true, nombre: true } };

// Lista liviana para asignar responsable/tareas — cualquiera con LECTURA en el
// módulo Desarrollo (iot) puede ver nombres, sin necesitar permiso de admin.
proyectosRouter.get("/usuarios", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
  res.json(usuarios);
});

// ───────────────────────── Proyectos ─────────────────────────

proyectosRouter.get("/", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const proyectos = await prisma.proyecto.findMany({
    include: {
      responsable: usuarioLite,
      tareas: { select: { estado: true } },
      _count: { select: { paginas: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(proyectos);
});

proyectosRouter.post("/", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { nombre, descripcion, estado, fechaInicio, fechaFin, responsableId } = req.body ?? {};
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

  const proyecto = await prisma.proyecto.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      estado: estado ?? "NO_INICIADO",
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      responsableId: responsableId ? Number(responsableId) : null,
    },
    include: { responsable: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.crear",
    entidad: "Proyecto",
    entidadId: proyecto.id,
    detalle: { proyecto },
  });

  res.status(201).json(proyecto);
});

proyectosRouter.get("/:id", requireAuth, requireModulo("iot", "LECTURA"), async (req, res) => {
  const id = Number(req.params.id);
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      responsable: usuarioLite,
      paginas: { orderBy: { orden: "asc" }, include: { autor: usuarioLite } },
      tareas: { orderBy: { orden: "asc" }, include: { asignado: usuarioLite } },
    },
  });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });
  res.json(proyecto);
});

proyectosRouter.patch("/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, descripcion, estado, fechaInicio, fechaFin, responsableId } = req.body ?? {};

  const anterior = await prisma.proyecto.findUnique({ where: { id } });
  if (!anterior) return res.status(404).json({ error: "Proyecto no encontrado" });

  const actualizado = await prisma.proyecto.update({
    where: { id },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(fechaInicio !== undefined ? { fechaInicio: fechaInicio ? new Date(fechaInicio) : null } : {}),
      ...(fechaFin !== undefined ? { fechaFin: fechaFin ? new Date(fechaFin) : null } : {}),
      ...(responsableId !== undefined ? { responsableId: responsableId ? Number(responsableId) : null } : {}),
    },
    include: { responsable: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.actualizar",
    entidad: "Proyecto",
    entidadId: id,
    detalle: { anterior, nuevo: actualizado },
  });

  res.json(actualizado);
});

// Sin bloqueos (igual que Inventario): la confirmación doble vive en el frontend.
// Páginas y tareas se eliminan en cascada (definido en el schema).
proyectosRouter.delete("/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const proyecto = await prisma.proyecto.findUnique({ where: { id } });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });

  await prisma.proyecto.delete({ where: { id } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.eliminar",
    entidad: "Proyecto",
    entidadId: id,
    detalle: { proyecto },
  });

  res.status(204).send();
});

// ───────────────────────── Páginas de documentación ─────────────────────────

proyectosRouter.post("/:id/paginas", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const { titulo, contenido } = req.body ?? {};
  if (!titulo) return res.status(400).json({ error: "titulo es requerido" });

  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });

  const max = await prisma.proyectoPagina.aggregate({ where: { proyectoId }, _max: { orden: true } });

  const pagina = await prisma.proyectoPagina.create({
    data: {
      proyectoId,
      titulo,
      contenido: contenido ?? "",
      orden: (max._max.orden ?? -1) + 1,
      autorId: req.user!.sub,
    },
    include: { autor: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.pagina.crear",
    entidad: "ProyectoPagina",
    entidadId: pagina.id,
    detalle: { proyectoId, titulo: pagina.titulo },
  });

  res.status(201).json(pagina);
});

proyectosRouter.patch("/paginas/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, contenido, orden } = req.body ?? {};

  const anterior = await prisma.proyectoPagina.findUnique({ where: { id } });
  if (!anterior) return res.status(404).json({ error: "Página no encontrada" });

  const actualizada = await prisma.proyectoPagina.update({
    where: { id },
    data: {
      ...(titulo !== undefined ? { titulo } : {}),
      ...(contenido !== undefined ? { contenido } : {}),
      ...(orden !== undefined ? { orden: Number(orden) } : {}),
    },
    include: { autor: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.pagina.actualizar",
    entidad: "ProyectoPagina",
    entidadId: id,
    detalle: { proyectoId: actualizada.proyectoId, titulo: actualizada.titulo },
  });

  res.json(actualizada);
});

proyectosRouter.delete("/paginas/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const pagina = await prisma.proyectoPagina.findUnique({ where: { id } });
  if (!pagina) return res.status(404).json({ error: "Página no encontrada" });

  await prisma.proyectoPagina.delete({ where: { id } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.pagina.eliminar",
    entidad: "ProyectoPagina",
    entidadId: id,
    detalle: { proyectoId: pagina.proyectoId, titulo: pagina.titulo },
  });

  res.status(204).send();
});

// ───────────────────────── Tareas (Kanban) ─────────────────────────

const ESTADOS_TAREA = ["POR_HACER", "EN_PROGRESO", "EN_REVISION", "HECHO"] as const;

proyectosRouter.post("/:id/tareas", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const { titulo, descripcion, asignadoId, fechaLimite, estado } = req.body ?? {};
  if (!titulo) return res.status(400).json({ error: "titulo es requerido" });
  if (estado !== undefined && !ESTADOS_TAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_TAREA.join(", ")}` });
  }

  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });

  const estadoFinal = estado ?? "POR_HACER";
  const max = await prisma.proyectoTarea.aggregate({ where: { proyectoId, estado: estadoFinal }, _max: { orden: true } });

  const tarea = await prisma.proyectoTarea.create({
    data: {
      proyectoId,
      titulo,
      descripcion: descripcion || null,
      estado: estadoFinal,
      orden: (max._max.orden ?? -1) + 1,
      asignadoId: asignadoId ? Number(asignadoId) : null,
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
    },
    include: { asignado: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.tarea.crear",
    entidad: "ProyectoTarea",
    entidadId: tarea.id,
    detalle: { proyectoId, titulo: tarea.titulo },
  });

  res.status(201).json(tarea);
});

proyectosRouter.patch("/tareas/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, descripcion, estado, asignadoId, fechaLimite, orden } = req.body ?? {};
  if (estado !== undefined && !ESTADOS_TAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_TAREA.join(", ")}` });
  }

  const anterior = await prisma.proyectoTarea.findUnique({ where: { id } });
  if (!anterior) return res.status(404).json({ error: "Tarea no encontrada" });

  const actualizada = await prisma.proyectoTarea.update({
    where: { id },
    data: {
      ...(titulo !== undefined ? { titulo } : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(asignadoId !== undefined ? { asignadoId: asignadoId ? Number(asignadoId) : null } : {}),
      ...(fechaLimite !== undefined ? { fechaLimite: fechaLimite ? new Date(fechaLimite) : null } : {}),
      ...(orden !== undefined ? { orden: Number(orden) } : {}),
    },
    include: { asignado: usuarioLite },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.tarea.actualizar",
    entidad: "ProyectoTarea",
    entidadId: id,
    detalle: { anterior, nuevo: actualizada },
  });

  res.json(actualizada);
});

proyectosRouter.delete("/tareas/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const tarea = await prisma.proyectoTarea.findUnique({ where: { id } });
  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  await prisma.proyectoTarea.delete({ where: { id } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.tarea.eliminar",
    entidad: "ProyectoTarea",
    entidadId: id,
    detalle: { proyectoId: tarea.proyectoId, titulo: tarea.titulo },
  });

  res.status(204).send();
});
