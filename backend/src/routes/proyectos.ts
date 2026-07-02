import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";
import fs from "fs";
import path from "path";

export const proyectosRouter = Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

// ───────────────────────── Glosario Técnico ─────────────────────────

proyectosRouter.get("/glosario", requireAuth, async (_req, res) => {
  try {
    const terminos = await prisma.terminoGlosario.findMany({ orderBy: { termino: "asc" } });
    res.json(terminos);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al obtener el glosario" });
  }
});

// Agregar un término (el glosario lo administra el área de Desarrollo).
proyectosRouter.post("/glosario", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { termino, definicion } = req.body ?? {};
  if (!termino || !definicion) {
    return res.status(400).json({ error: "termino y definicion son requeridos" });
  }
  try {
    const nuevoTermino = await prisma.terminoGlosario.create({
      data: { termino: termino.trim(), definicion: definicion.trim() },
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "glosario.termino.crear",
      entidad: "TerminoGlosario",
      entidadId: nuevoTermino.id,
      detalle: { termino: nuevoTermino.termino },
    });

    res.status(201).json(nuevoTermino);
  } catch {
    res.status(400).json({ error: "El término ya existe o hay un error al guardarlo." });
  }
});

// Eliminar un término
proyectosRouter.delete("/glosario/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const eliminado = await prisma.terminoGlosario.delete({ where: { id } });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "glosario.termino.eliminar",
      entidad: "TerminoGlosario",
      entidadId: id,
      detalle: { termino: eliminado.termino },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al eliminar el término." });
  }
});

// ───────────────────────── Pizarra general de ideas ─────────────────────────
// Una sola pizarra compartida del área (fila con proyectoId null). Debe
// registrarse antes de "/:id" para que el comodín no capture la ruta.

proyectosRouter.get("/pizarra-general", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const pizarra = await prisma.pizarra.findFirst({ where: { proyectoId: null } });
  res.json(pizarra ?? { proyectoId: null, contenido: { elements: [] }, updatedAt: null });
});

proyectosRouter.put("/pizarra-general", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { contenido } = req.body ?? {};
  if (!contenido || typeof contenido !== "object") {
    return res.status(400).json({ error: "contenido es requerido" });
  }

  const existente = await prisma.pizarra.findFirst({ where: { proyectoId: null } });
  const pizarra = existente
    ? await prisma.pizarra.update({ where: { id: existente.id }, data: { contenido } })
    : await prisma.pizarra.create({ data: { proyectoId: null, contenido } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.pizarra.guardar",
    entidad: "Pizarra",
    entidadId: pizarra.id,
    detalle: { general: true },
  });

  res.json(pizarra);
});

// ───────────────────────── Tecnologías y Equipos (I+D y Tecnologías) ─────────────────────────

// Obtener tecnologías globales (todas en el repositorio central)
proyectosRouter.get("/tecnologias/globales", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  try {
    const tecnologias = await prisma.tecnologia.findMany({
      include: { archivos: { orderBy: { fechaSubida: "desc" } } },
      orderBy: { fechaCreacion: "desc" },
    });
    res.json(tecnologias);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al obtener tecnologías globales" });
  }
});

// Crear una tecnología (siempre se registra a nivel global de I+D)
proyectosRouter.post("/tecnologias", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { nombre, descripcion, categoria } = req.body ?? {};

  if (!nombre || !categoria) {
    return res.status(400).json({ error: "nombre y categoria son requeridos" });
  }

  try {
    const tecnologia = await prisma.tecnologia.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        categoria,
      },
      include: { archivos: true },
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.tecnologia.crear",
      entidad: "Tecnologia",
      entidadId: tecnologia.id,
      detalle: { nombre: tecnologia.nombre },
    });

    res.status(201).json(tecnologia);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al crear tecnología" });
  }
});

// Eliminar una tecnología (se eliminan en cascada sus archivos en la DB)
proyectosRouter.delete("/tecnologias/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const tecnologia = await prisma.tecnologia.findUnique({
    where: { id },
    include: { archivos: true },
  });
  if (!tecnologia) return res.status(404).json({ error: "Tecnología no encontrada" });

  try {
    // Eliminar los archivos físicos del disco primero
    for (const archivo of tecnologia.archivos) {
      const filename = path.basename(archivo.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.tecnologia.delete({ where: { id } });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.tecnologia.eliminar",
      entidad: "Tecnologia",
      entidadId: id,
      detalle: { nombre: tecnologia.nombre },
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al eliminar tecnología" });
  }
});

proyectosRouter.get("/:id", requireAuth, requireModulo("iot", "LECTURA"), async (req, res) => {
  const id = Number(req.params.id);
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      responsable: usuarioLite,
      paginas: { orderBy: { orden: "asc" }, include: { autor: usuarioLite } },
      tareas: { orderBy: { orden: "asc" }, include: { asignado: usuarioLite } },
      tecnologias: { orderBy: { fechaCreacion: "desc" }, include: { archivos: { orderBy: { fechaSubida: "desc" } } } },
      componentesStack: { orderBy: { id: "asc" } },
    },
  });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });
  res.json(proyecto);
});

// ───────────────────────── Pizarra de planificación ─────────────────────────

proyectosRouter.get("/:id/pizarra", requireAuth, requireModulo("iot", "LECTURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const pizarra = await prisma.pizarra.findUnique({ where: { proyectoId } });
  // Sin pizarra guardada aún: contenido vacío (el frontend parte de cero).
  res.json(pizarra ?? { proyectoId, contenido: { strokes: [] }, updatedAt: null });
});

proyectosRouter.put("/:id/pizarra", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const { contenido } = req.body ?? {};

  if (!contenido || typeof contenido !== "object") {
    return res.status(400).json({ error: "contenido es requerido" });
  }

  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });

  const pizarra = await prisma.pizarra.upsert({
    where: { proyectoId },
    update: { contenido },
    create: { proyectoId, contenido },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "proyecto.pizarra.guardar",
    entidad: "Pizarra",
    entidadId: pizarra.id,
    detalle: { proyectoId, trazos: Array.isArray((contenido as any).strokes) ? (contenido as any).strokes.length : null },
  });

  res.json(pizarra);
});

// Enlazar una tecnología a un proyecto
proyectosRouter.post("/:id/tecnologias", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const { tecnologiaId } = req.body ?? {};

  if (!tecnologiaId) {
    return res.status(400).json({ error: "tecnologiaId es requerido" });
  }

  try {
    const proyecto = await prisma.proyecto.update({
      where: { id: proyectoId },
      data: {
        tecnologias: {
          connect: { id: Number(tecnologiaId) }
        }
      },
      include: { tecnologias: { include: { archivos: true } } }
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.tecnologia.enlazar",
      entidad: "Proyecto",
      entidadId: proyectoId,
      detalle: { tecnologiaId },
    });

    res.json(proyecto.tecnologias);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al enlazar tecnología" });
  }
});

// Desenlazar una tecnología de un proyecto
proyectosRouter.delete("/:id/tecnologias/:tecnologiaId", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const tecnologiaId = Number(req.params.tecnologiaId);

  try {
    await prisma.proyecto.update({
      where: { id: proyectoId },
      data: {
        tecnologias: {
          disconnect: { id: tecnologiaId }
        }
      }
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.tecnologia.desenlazar",
      entidad: "Proyecto",
      entidadId: proyectoId,
      detalle: { tecnologiaId },
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al desenlazar tecnología" });
  }
});

// Agregar componente al stack tecnológico del proyecto
proyectosRouter.post("/:id/stack", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const proyectoId = Number(req.params.id);
  const { capa, nombre, detalles } = req.body ?? {};

  if (!capa || !nombre) {
    return res.status(400).json({ error: "capa y nombre son requeridos" });
  }

  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) return res.status(404).json({ error: "Proyecto no encontrado" });

  try {
    const componente = await prisma.componenteStack.create({
      data: {
        capa,
        nombre,
        detalles: detalles || null,
        proyectoId,
      },
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.stack.agregar",
      entidad: "ComponenteStack",
      entidadId: componente.id,
      detalle: { proyectoId, nombre: componente.nombre, capa: componente.capa },
    });

    res.status(201).json(componente);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al agregar componente al stack" });
  }
});

// Eliminar componente del stack tecnológico del proyecto
proyectosRouter.delete("/stack/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const componente = await prisma.componenteStack.findUnique({ where: { id } });
  if (!componente) return res.status(404).json({ error: "Componente no encontrado" });

  try {
    await prisma.componenteStack.delete({ where: { id } });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.stack.eliminar",
      entidad: "ComponenteStack",
      entidadId: id,
      detalle: { proyectoId: componente.proyectoId, nombre: componente.nombre, capa: componente.capa },
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al eliminar componente del stack" });
  }
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

proyectosRouter.post("/tecnologias/:id/archivos", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const tecnologiaId = Number(req.params.id);
  const { nombre, extension, archivoBase64 } = req.body ?? {};

  if (!nombre || !extension || !archivoBase64) {
    return res.status(400).json({ error: "nombre, extension y archivoBase64 son requeridos" });
  }

  const tecnologia = await prisma.tecnologia.findUnique({ where: { id: tecnologiaId } });
  if (!tecnologia) return res.status(404).json({ error: "Tecnología no encontrada" });

  try {
    const buffer = Buffer.from(archivoBase64, "base64");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    
    fs.writeFileSync(filePath, buffer);

    const archivo = await prisma.archivoTecnico.create({
      data: {
        nombre,
        url: `/uploads/${uniqueName}`,
        extension,
        tecnologiaId,
      },
    });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.archivo.subir",
      entidad: "ArchivoTecnico",
      entidadId: archivo.id,
      detalle: { tecnologiaId, nombre: archivo.nombre },
    });

    res.status(201).json(archivo);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al subir el archivo" });
  }
});

proyectosRouter.delete("/archivos/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const archivo = await prisma.archivoTecnico.findUnique({ where: { id } });
  if (!archivo) return res.status(404).json({ error: "Archivo no encontrado" });

  try {
    const filename = path.basename(archivo.url);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.archivoTecnico.delete({ where: { id } });

    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "proyecto.archivo.eliminar",
      entidad: "ArchivoTecnico",
      entidadId: id,
      detalle: { tecnologiaId: archivo.tecnologiaId, nombre: archivo.nombre },
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al eliminar archivo" });
  }
});
