import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";

export const obrasRouter = Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const usuarioLite = { select: { id: true, nombre: true } };

// Avance referencial por fase global (aún no hay un cálculo fino por track).
const FASE_AVANCE: Record<string, number> = { INICIO: 15, GESTION: 50, EJECUCION: 80, CERRADO: 100 };

// Los costos (presupuesto, costo acumulado, cotizaciones) son visibles solo
// para Jefatura y Gerencia — nunca se delega esta regla al frontend.
function puedeVerCostos(rolNombre: string | undefined) {
  return rolNombre === "gerencia" || rolNombre === "jefatura";
}

// Acciones de administración de la obra (asignar responsables, eliminar) las
// realiza la jefatura/gerencia (rol de Javier). La gestión operativa de tracks
// y subtareas la puede hacer cualquier usuario autenticado (los coordinadores).
function puedeAdministrar(rolNombre: string | undefined) {
  return rolNombre === "gerencia" || rolNombre === "jefatura";
}

const ESTADOS_SUBTAREA = ["POR_HACER", "EN_PROGRESO", "EN_REVISION", "HECHO"] as const;

function redactarCostos<T extends { presupuesto?: unknown; costoAcumulado?: unknown; solicitudes?: any[] }>(obra: T): T {
  const copia: any = { ...obra };
  delete copia.presupuesto;
  delete copia.costoAcumulado;
  if (Array.isArray(copia.solicitudes)) {
    copia.solicitudes = copia.solicitudes.map((s: any) => {
      const { costoTotal, items, ...resto } = s;
      return {
        ...resto,
        items: Array.isArray(items) ? items.map(({ precioUnitario, ...i }: any) => i) : items,
      };
    });
  }
  return copia;
}

// GET /obras - Listado de obras
obrasRouter.get("/", requireAuth, async (req, res) => {
  const obras = await prisma.obra.findMany({
    include: {
      subgerente: usuarioLite,
      coordinador: usuarioLite,
      tracks: true, // Para ver el estado de los tracks desde el tablero
    },
    orderBy: { updatedAt: "desc" },
  });

  const verCostos = puedeVerCostos(req.user?.rolNombre);
  const conAvance = obras.map((o) => ({ ...o, avance: FASE_AVANCE[o.faseGlobal] ?? 0 }));
  res.json(verCostos ? conAvance : conAvance.map(redactarCostos));
});

// Riesgo derivado del estado de los tracks (proceso no lineal): un track de
// programación bloqueado o un permiso esperando a un organismo externo elevan
// el riesgo global del proyecto.
function evaluarRiesgo(tracks: { tipo: string; estadoActual: string }[]) {
  const prog = tracks.find((t) => t.tipo === "PROGRAMACION");
  const perm = tracks.find((t) => t.tipo === "PERMISOS");
  if (prog && prog.estadoActual.startsWith("BLOQUEADO")) return { nivel: "BLOQUEADO", motivo: "Programación bloqueada" };
  if (perm && perm.estadoActual.includes("ESPERANDO")) return { nivel: "RIESGO", motivo: "Permiso atrasado" };
  return { nivel: "OK", motivo: "OK" };
}

// GET /obras/dashboard - Panel ejecutivo del Subgerente (KPIs, salud, hitos, alertas).
// Debe declararse antes de "/:id" para no ser capturado como un id.
obrasRouter.get("/dashboard", requireAuth, async (req, res) => {
  const verCostos = puedeVerCostos(req.user?.rolNombre);

  const obras = await prisma.obra.findMany({
    include: { coordinador: usuarioLite, tracks: true },
    orderBy: { updatedAt: "desc" },
  });
  const activas = obras.filter((o) => o.faseGlobal !== "CERRADO");

  const saludProyectos = activas.map((o) => {
    const riesgo = evaluarRiesgo(o.tracks);
    return {
      id: o.id,
      nombre: o.nombre,
      tipoObra: o.tipoObra,
      faseGlobal: o.faseGlobal,
      avance: FASE_AVANCE[o.faseGlobal] ?? 0,
      coordinador: o.coordinador,
      riesgoNivel: riesgo.nivel,
      riesgoMotivo: riesgo.motivo,
      ...(verCostos ? { costoAcumulado: o.costoAcumulado } : {}),
    };
  });

  const alertas = activas
    .map((o) => ({ obra: o, riesgo: evaluarRiesgo(o.tracks) }))
    .filter(({ riesgo }) => riesgo.nivel !== "OK")
    .map(({ obra, riesgo }) => ({ obraId: obra.id, obra: obra.nombre, nivel: riesgo.nivel, motivo: riesgo.motivo }));

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [hitosSemana, hitosRecientes] = await Promise.all([
    prisma.obraBitacora.count({ where: { createdAt: { gte: hace7dias } } }),
    prisma.obraBitacora.findMany({
      include: { autor: usuarioLite, obra: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  res.json({
    kpis: {
      proyectosActivos: activas.length,
      bloqueados: alertas.filter((a) => a.nivel === "BLOQUEADO").length,
      hitosSemana,
      // null cuando el rol no puede ver costos: el frontend oculta la tarjeta.
      costoIncurridoTotal: verCostos ? activas.reduce((s, o) => s + Number(o.costoAcumulado), 0) : null,
    },
    saludProyectos,
    hitosRecientes,
    alertas,
  });
});

// GET /obras/usuarios - Lista liviana para asignar responsables (cualquier
// usuario autenticado puede ver nombres; debe ir antes de "/:id").
obrasRouter.get("/usuarios", requireAuth, async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, rol: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });
  res.json(usuarios.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol.nombre })));
});

// ───────────────────────── Tracks y subtareas (kanban) ─────────────────────
// Rutas de dos segmentos (/tracks/:id, /subtareas/:id) no chocan con "/:id".

// PATCH /obras/tracks/:trackId - actualizar estado o responsable del track.
obrasRouter.patch("/tracks/:trackId", requireAuth, async (req, res) => {
  const trackId = Number(req.params.trackId);
  const { estadoActual, responsableId } = req.body ?? {};

  const track = await prisma.obraTrack.findUnique({ where: { id: trackId }, include: { responsable: usuarioLite } });
  if (!track) return res.status(404).json({ error: "Track no encontrado" });

  const actualizado = await prisma.obraTrack.update({
    where: { id: trackId },
    data: {
      ...(estadoActual !== undefined ? { estadoActual: String(estadoActual) } : {}),
      ...(responsableId !== undefined ? { responsableId: responsableId ? Number(responsableId) : null } : {}),
      ultimaActualizacion: new Date(),
    },
    include: { responsable: usuarioLite, subtareas: { orderBy: { orden: "asc" } } },
  });

  // Registrar en la bitácora del proyecto los cambios relevantes.
  if (estadoActual !== undefined && estadoActual !== track.estadoActual) {
    await prisma.obraBitacora.create({
      data: {
        obraId: track.obraId,
        autorId: req.user!.sub,
        tipoEvento: "CAMBIO_ESTADO",
        mensaje: `Track ${track.tipo}: ${track.estadoActual} → ${estadoActual}.`,
      },
    });
  }

  res.json(actualizado);
});

// POST /obras/tracks/:trackId/subtareas - crear subtarea en el kanban del track.
obrasRouter.post("/tracks/:trackId/subtareas", requireAuth, async (req, res) => {
  const trackId = Number(req.params.trackId);
  const { titulo, estado } = req.body ?? {};
  if (!titulo?.trim()) return res.status(400).json({ error: "titulo es requerido" });
  if (estado !== undefined && !ESTADOS_SUBTAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_SUBTAREA.join(", ")}` });
  }

  const track = await prisma.obraTrack.findUnique({ where: { id: trackId } });
  if (!track) return res.status(404).json({ error: "Track no encontrado" });

  const estadoFinal = estado ?? "POR_HACER";
  const max = await prisma.obraSubtarea.aggregate({ where: { trackId, estado: estadoFinal }, _max: { orden: true } });

  const subtarea = await prisma.obraSubtarea.create({
    data: { trackId, titulo: titulo.trim(), estado: estadoFinal, orden: (max._max.orden ?? -1) + 1 },
  });
  res.status(201).json(subtarea);
});

// PATCH /obras/subtareas/:id - mover (cambiar estado), renombrar, reordenar o
// editar las notas/observaciones.
obrasRouter.patch("/subtareas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, estado, orden, notas } = req.body ?? {};
  if (estado !== undefined && !ESTADOS_SUBTAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_SUBTAREA.join(", ")}` });
  }

  const existe = await prisma.obraSubtarea.findUnique({ where: { id } });
  if (!existe) return res.status(404).json({ error: "Subtarea no encontrada" });

  const actualizada = await prisma.obraSubtarea.update({
    where: { id },
    data: {
      ...(titulo !== undefined ? { titulo: String(titulo) } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(orden !== undefined ? { orden: Number(orden) } : {}),
      ...(notas !== undefined ? { notas: notas ? String(notas) : null } : {}),
    },
    include: { archivos: { orderBy: { createdAt: "asc" } } },
  });
  res.json(actualizada);
});

// POST /obras/subtareas/:id/archivos - adjuntar documentación (base64 en JSON).
obrasRouter.post("/subtareas/:id/archivos", requireAuth, async (req, res) => {
  const subtareaId = Number(req.params.id);
  const { nombre, extension, archivoBase64 } = req.body ?? {};
  if (!nombre || !extension || !archivoBase64) {
    return res.status(400).json({ error: "nombre, extension y archivoBase64 son requeridos" });
  }

  const subtarea = await prisma.obraSubtarea.findUnique({ where: { id: subtareaId } });
  if (!subtarea) return res.status(404).json({ error: "Subtarea no encontrada" });

  try {
    const buffer = Buffer.from(archivoBase64, "base64");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);

    const archivo = await prisma.obraSubtareaArchivo.create({
      data: { subtareaId, nombre, url: `/uploads/${uniqueName}`, extension },
    });
    res.status(201).json(archivo);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al subir el archivo" });
  }
});

// DELETE /obras/subtareas/archivos/:id - eliminar un adjunto (archivo + registro).
obrasRouter.delete("/subtareas/archivos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const archivo = await prisma.obraSubtareaArchivo.findUnique({ where: { id } });
  if (!archivo) return res.status(404).json({ error: "Archivo no encontrado" });

  const filePath = path.join(UPLOADS_DIR, path.basename(archivo.url));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.obraSubtareaArchivo.delete({ where: { id } });
  res.status(204).send();
});

// DELETE /obras/subtareas/:id
obrasRouter.delete("/subtareas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existe = await prisma.obraSubtarea.findUnique({ where: { id } });
  if (!existe) return res.status(404).json({ error: "Subtarea no encontrada" });
  await prisma.obraSubtarea.delete({ where: { id } });
  res.status(204).send();
});

// GET /obras/:id - Detalle de obra con todos sus tracks y bitácora
obrasRouter.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const obra = await prisma.obra.findUnique({
    where: { id },
    include: {
      subgerente: usuarioLite,
      coordinador: usuarioLite,
      tracks: {
        include: {
          responsable: usuarioLite,
          subtareas: {
            orderBy: { orden: "asc" },
            include: { archivos: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
      bitacora: {
        include: { autor: usuarioLite },
        orderBy: { createdAt: "desc" },
      },
      solicitudes: {
        include: {
          solicitante: usuarioLite,
          items: true,
        },
      },
      programaciones: {
        include: { programador: usuarioLite },
      },
      equipamiento: true,
    },
  });

  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const conAvance = { ...obra, avance: FASE_AVANCE[obra.faseGlobal] ?? 0 };
  res.json(puedeVerCostos(req.user?.rolNombre) ? conAvance : redactarCostos(conAvance));
});

const FASES_OBRA = ["INICIO", "GESTION", "EJECUCION", "CERRADO"] as const;

// PATCH /obras/:id - asignar responsables (subgerente/coordinador), fase o
// presupuesto. Solo jefatura/gerencia (rol de Javier).
obrasRouter.patch("/:id", requireAuth, async (req, res) => {
  if (!puedeAdministrar(req.user?.rolNombre)) {
    return res.status(403).json({ error: "Solo jefatura o gerencia puede administrar la obra" });
  }
  const id = Number(req.params.id);
  const { subgerenteId, coordinadorId, faseGlobal, presupuesto, fechaEntrega } = req.body ?? {};
  if (faseGlobal !== undefined && !FASES_OBRA.includes(faseGlobal)) {
    return res.status(400).json({ error: `faseGlobal debe ser una de: ${FASES_OBRA.join(", ")}` });
  }

  const anterior = await prisma.obra.findUnique({ where: { id }, include: { coordinador: usuarioLite } });
  if (!anterior) return res.status(404).json({ error: "Obra no encontrada" });

  const obra = await prisma.obra.update({
    where: { id },
    data: {
      ...(subgerenteId !== undefined ? { subgerenteId: subgerenteId ? Number(subgerenteId) : null } : {}),
      ...(coordinadorId !== undefined ? { coordinadorId: coordinadorId ? Number(coordinadorId) : null } : {}),
      ...(faseGlobal !== undefined ? { faseGlobal } : {}),
      ...(presupuesto !== undefined ? { presupuesto: presupuesto ? Number(presupuesto) : null } : {}),
      ...(fechaEntrega !== undefined ? { fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null } : {}),
    },
    include: { subgerente: usuarioLite, coordinador: usuarioLite },
  });

  // Deja rastro del traspaso de coordinador en la bitácora (clave para traspasos).
  if (coordinadorId !== undefined && (anterior.coordinadorId ?? null) !== (obra.coordinadorId ?? null)) {
    await prisma.obraBitacora.create({
      data: {
        obraId: id,
        autorId: req.user!.sub,
        tipoEvento: "REASIGNACION",
        mensaje: `Coordinador reasignado: ${anterior.coordinador?.nombre ?? "sin asignar"} → ${obra.coordinador?.nombre ?? "sin asignar"}.`,
      },
    });
  }

  res.json(obra);
});

// DELETE /obras/:id - eliminar obra (cascada de tracks/subtareas/bitácora).
// Solo jefatura/gerencia.
obrasRouter.delete("/:id", requireAuth, async (req, res) => {
  if (!puedeAdministrar(req.user?.rolNombre)) {
    return res.status(403).json({ error: "Solo jefatura o gerencia puede eliminar la obra" });
  }
  const id = Number(req.params.id);
  const obra = await prisma.obra.findUnique({ where: { id } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });
  await prisma.obra.delete({ where: { id } });
  res.status(204).send();
});

// POST /obras/:id/bitacora - registrar un hito manual en la bitácora.
obrasRouter.post("/:id/bitacora", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { mensaje, tipoEvento } = req.body ?? {};
  if (!mensaje?.trim()) return res.status(400).json({ error: "mensaje es requerido" });

  const obra = await prisma.obra.findUnique({ where: { id } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const hito = await prisma.obraBitacora.create({
    data: { obraId: id, autorId: req.user!.sub, tipoEvento: tipoEvento || "HITO", mensaje: mensaje.trim() },
    include: { autor: usuarioLite },
  });
  res.status(201).json(hito);
});

// POST /obras/:id/materiales - agregar una solicitud de materiales (inventario
// asociado al track de Adquisiciones). El costo lo completa Bodega más adelante.
obrasRouter.post("/:id/materiales", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items es requerido (al menos uno)" });
  }

  const obra = await prisma.obra.findUnique({ where: { id } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const solicitud = await prisma.solicitudMaterial.create({
    data: {
      obraId: id,
      solicitanteId: req.user!.sub,
      estado: "SOLICITADO",
      items: {
        create: items.map((it: any) => ({
          articuloDesc: String(it.articuloDesc ?? "").trim(),
          cantidad: Number(it.cantidad) || 1,
          itemId: it.itemId ? Number(it.itemId) : null,
        })),
      },
    },
    include: { solicitante: usuarioLite, items: true },
  });

  await prisma.obraBitacora.create({
    data: {
      obraId: id,
      autorId: req.user!.sub,
      tipoEvento: "MATERIALES",
      mensaje: `Solicitud de materiales enviada a Bodega — ${solicitud.items.length} ítem(s).`,
    },
  });

  res.status(201).json(solicitud);
});

// POST /obras - Crear nueva obra
obrasRouter.post("/", requireAuth, async (req, res) => {
  const { codigoObra, nombre, cliente, tipoObra, presupuesto, subgerenteId, coordinadorId, fechaEntrega } = req.body ?? {};
  
  if (!codigoObra || !nombre || !cliente || !tipoObra) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Al crear una obra, se pueden inicializar automáticamente sus tracks principales
  const obra = await prisma.obra.create({
    data: {
      codigoObra,
      nombre,
      cliente,
      tipoObra,
      presupuesto: presupuesto ? Number(presupuesto) : null,
      subgerenteId: subgerenteId ? Number(subgerenteId) : null,
      coordinadorId: coordinadorId ? Number(coordinadorId) : null,
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      // Inicializar tracks básicos en PENDIENTE o NO_INICIADO
      tracks: {
        create: [
          { tipo: "PERMISOS", estadoActual: "NO_INICIADO" },
          { tipo: "ADQUISICIONES", estadoActual: "PLANIFICACION" },
          { tipo: "PROGRAMACION", estadoActual: "ESPERANDO_REQUERIMIENTOS" },
          { tipo: "INSTALACION", estadoActual: "PLANIFICACION" },
        ]
      },
      bitacora: {
        create: {
          autorId: req.user!.sub,
          tipoEvento: "CREACION",
          mensaje: "Obra creada e inicializada en el sistema.",
        }
      }
    },
    include: {
      subgerente: usuarioLite,
      coordinador: usuarioLite,
      tracks: true,
    }
  });

  res.json(obra);
});

// Más endpoints de actualización, tracks, bitácora se agregarían aquí según necesidad.
