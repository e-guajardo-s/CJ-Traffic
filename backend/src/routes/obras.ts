import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { esGerencia, puedeAdministrarObra, puedeVerCostos } from "../rbac";

export const obrasRouter = Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const usuarioLite = { select: { id: true, nombre: true } };

// Avance referencial por fase global (aún no hay un cálculo fino por track).
const FASE_AVANCE: Record<string, number> = { INICIO: 15, GESTION: 50, EJECUCION: 80, CERRADO: 100 };

const ESTADOS_SUBTAREA = ["POR_HACER", "EN_PROGRESO", "EN_REVISION", "HECHO", "BLOQUEADO"] as const;

const TIPOS_TRACK_VALIDOS = [
  "PERMISOS", "ADQUISICIONES", "PROGRAMACION", "INSTALACION", "COMUNICACIONES",
  "ENLACES", "EMPALMES", "HITOS_UOCT", "SINTONIA_FINA", "TRASPASOS_MANTENCION",
  "CANALIZACION", "OBRAS_CIVILES", "OTRO",
] as const;

// Valida y normaliza el array de líneas de trabajo recibido al crear una obra
// o al agregar una línea nueva: cada entrada debe tener un `tipo` conocido, y
// si es "OTRO" requiere un `nombre` libre (no tiene label en TRACK_META).
function normalizarTracks(input: unknown): { tipo: string; nombre: string | null }[] {
  if (!Array.isArray(input)) return [];
  return input.map((t: any) => {
    const tipo = String(t?.tipo ?? "");
    if (!TIPOS_TRACK_VALIDOS.includes(tipo as any)) {
      throw new Error(`tipo de línea de trabajo inválido: ${tipo}`);
    }
    const nombre = t?.nombre ? String(t.nombre).trim() : null;
    if (tipo === "OTRO" && !nombre) {
      throw new Error("Las líneas de trabajo personalizadas (Otro) requieren un nombre");
    }
    return { tipo, nombre: tipo === "OTRO" ? nombre : null };
  });
}
const PRIORIDADES_SUBTAREA = ["BAJA", "MEDIA", "ALTA", "URGENTE"] as const;

// El estado operativo del track se deriva de sus subtareas, no se edita a mano:
// si alguna está bloqueada, el track está bloqueado (visibilidad inmediata del
// riesgo); si todas están hechas, está completo; si hay alguna en curso, está en
// curso; si no hay subtareas o todas están "por hacer", no ha iniciado.
function derivarEstadoTrack(subtareas: { estado: string }[]): string {
  if (subtareas.length === 0) return "NO_INICIADO";
  if (subtareas.some((s) => s.estado === "BLOQUEADO")) return "BLOQUEADO";
  if (subtareas.every((s) => s.estado === "HECHO")) return "COMPLETADO";
  if (subtareas.some((s) => s.estado === "EN_PROGRESO" || s.estado === "EN_REVISION")) return "EN_CURSO";
  return "NO_INICIADO";
}

// Recalcula y persiste el estado del track a partir de sus subtareas actuales.
// Se llama tras cualquier cambio que pueda alterar la composición del kanban
// (crear/editar estado/eliminar subtarea). Deja rastro en bitácora si cambió.
async function recalcularEstadoTrack(trackId: number, autorId: number) {
  const track = await prisma.obraTrack.findUnique({
    where: { id: trackId },
    include: { subtareas: { select: { estado: true } } },
  });
  if (!track) return;

  const nuevoEstado = derivarEstadoTrack(track.subtareas);
  if (nuevoEstado === track.estadoActual) return;

  await prisma.obraTrack.update({
    where: { id: trackId },
    data: { estadoActual: nuevoEstado, ultimaActualizacion: new Date() },
  });

  await prisma.obraBitacora.create({
    data: {
      obraId: track.obraId,
      autorId,
      tipoEvento: "CAMBIO_ESTADO_TRACK",
      mensaje: `Tablero "${track.tipo}" pasó automáticamente a ${nuevoEstado.replace("_", " ")}`,
    },
  });
}

// Coordinadores con autoridad plena sobre la obra en este momento: el
// coordinador principal (Obra.coordinadorId) más los co-coordinadores por
// transferencia TEMPORAL o PARALELO que sigan `activo` y no hayan vencido.
async function coordinadoresEfectivos(obraId: number, coordinadorPrincipalId: number | null): Promise<Set<number>> {
  const ids = new Set<number>();
  if (coordinadorPrincipalId) ids.add(coordinadorPrincipalId);
  const extra = await prisma.obraCoordinadorExtra.findMany({
    where: { obraId, activo: true, OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: new Date() } }] },
    select: { coordinadorId: true },
  });
  for (const e of extra) ids.add(e.coordinadorId);
  return ids;
}

// Autoridad plena sobre una línea de trabajo: administra la obra (gerencia/
// jefatura), es coordinador efectivo del proyecto, o es el responsable
// asignado a ESE track (el subgerente/coordinador se lo delegó).
async function puedeGestionarTrack(
  user: { sub?: number; roles?: string[] } | undefined,
  obraId: number,
  coordinadorPrincipalId: number | null,
  trackResponsableId: number | null,
): Promise<boolean> {
  if (puedeAdministrarObra(user)) return true;
  if (trackResponsableId != null && trackResponsableId === user?.sub) return true;
  const coords = await coordinadoresEfectivos(obraId, coordinadorPrincipalId);
  return !!user?.sub && coords.has(user.sub);
}

// Movimiento acotado (drag & drop de su propia tarjeta): solo si el track ya
// tiene un responsable asignado (si no lo tiene, nadie salvo quien gestiona
// el proyecto puede tocarlo) y la subtarea está asignada a este usuario.
function esAsignadoConTrackActivo(trackResponsableId: number | null, subtareaAsignadoId: number | null, userId: number | undefined): boolean {
  return trackResponsableId != null && subtareaAsignadoId != null && subtareaAsignadoId === userId;
}

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
      tracks: {
        include: {
          subtareas: { select: { estado: true, fechaVencimiento: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const verCostos = puedeVerCostos(req.user);
  const ahora = new Date();
  const conAvance = obras.map((o) => {
    // Un proyecto cerrado no debe seguir alertando aunque queden tracks bloqueados.
    const riesgo = o.faseGlobal === "CERRADO" ? { nivel: "OK", motivo: "OK" } : evaluarRiesgo(o.tracks);
    const subs = o.tracks.flatMap((t) => t.subtareas);
    return {
      ...o,
      avance: FASE_AVANCE[o.faseGlobal] ?? 0,
      riesgoNivel: riesgo.nivel,
      riesgoMotivo: riesgo.motivo,
      subtareasBloqueadas: subs.filter((s) => s.estado === "BLOQUEADO").length,
      tareasVencidas: subs.filter((s) => s.estado !== "HECHO" && s.fechaVencimiento && s.fechaVencimiento < ahora).length,
    };
  });
  res.json(verCostos ? conAvance : conAvance.map(redactarCostos));
});

// Riesgo derivado del estado de los tracks (proceso no lineal): un track de
// programación bloqueado o un permiso esperando a un organismo externo elevan
// el riesgo global del proyecto.
function evaluarRiesgo(tracks: { tipo: string; estadoActual: string }[]) {
  const prog = tracks.find((t) => t.tipo === "PROGRAMACION");
  const perm = tracks.find((t) => t.tipo === "PERMISOS");
  
  if (prog && prog.estadoActual.startsWith("BLOQUEADO")) return { nivel: "BLOQUEADO", motivo: "Programación bloqueada" };
  
  const otroBloqueado = tracks.find((t) => t.estadoActual === "BLOQUEADO" || t.estadoActual.startsWith("BLOQUEADO"));
  if (otroBloqueado) return { nivel: "BLOQUEADO", motivo: `Track de ${otroBloqueado.tipo.toLowerCase()} bloqueado` };

  if (perm && perm.estadoActual.includes("ESPERANDO")) return { nivel: "RIESGO", motivo: "Permiso atrasado" };
  
  return { nivel: "OK", motivo: "OK" };
}

// GET /obras/dashboard - Panel ejecutivo del Subgerente (KPIs, salud, hitos, alertas).
// Debe declararse antes de "/:id" para no ser capturado como un id.
obrasRouter.get("/dashboard", requireAuth, async (req, res) => {
  const verCostos = puedeVerCostos(req.user);

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

// GET /obras/alertas/tareas - Devuelve los tracks problemáticos y sus tareas para gerencia
obrasRouter.get("/alertas/tareas", requireAuth, async (req, res) => {
  if (!puedeAdministrarObra(req.user)) {
    return res.status(403).json({ error: "Solo gerencia/jefatura puede gestionar alertas" });
  }

  const activas = await prisma.obra.findMany({
    where: { faseGlobal: { not: "CERRADO" } },
    include: {
      tracks: {
        include: {
          subtareas: { 
            orderBy: { orden: "asc" },
            include: { observaciones: { include: { autor: true }, orderBy: { createdAt: "asc" } } }
          },
          responsable: usuarioLite,
        }
      }
    }
  });

  const resultados = [];
  const tareasPorVencer = [];
  const tresDiasDespues = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  for (const obra of activas) {
    const riesgo = evaluarRiesgo(obra.tracks);
    if (riesgo.nivel !== "OK") {
      const tracksProblema = obra.tracks.filter(t => 
        (t.tipo === "PROGRAMACION" && t.estadoActual.startsWith("BLOQUEADO")) ||
        (t.tipo === "PERMISOS" && t.estadoActual.includes("ESPERANDO")) ||
        t.estadoActual === "BLOQUEADO"
      );
      
      resultados.push({
        obraId: obra.id,
        obraNombre: obra.nombre,
        riesgo,
        tracks: tracksProblema
      });
    }

    for (const track of obra.tracks) {
      for (const sub of track.subtareas) {
        if (sub.estado !== "HECHO" && sub.fechaVencimiento && sub.fechaVencimiento < tresDiasDespues) {
          tareasPorVencer.push({
            obraId: obra.id,
            obraNombre: obra.nombre,
            trackId: track.id,
            trackTipo: track.tipo,
            subtareaId: sub.id,
            titulo: sub.titulo,
            fechaVencimiento: sub.fechaVencimiento,
            estado: sub.estado,
          });
        }
      }
    }
  }

  // Ordenar tareas por vencer (las más críticas/atrasadas primero)
  tareasPorVencer.sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());

  res.json({ alertas: resultados, tareasPorVencer });
});

// GET /obras/usuarios - Lista liviana para asignar responsables (cualquier
// usuario autenticado puede ver nombres; debe ir antes de "/:id").
obrasRouter.get("/usuarios", requireAuth, async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, roles: { select: { rol: { select: { nombre: true } } } } },
    orderBy: { nombre: "asc" },
  });
  res.json(usuarios.map((u) => ({ id: u.id, nombre: u.nombre, roles: u.roles.map((r) => r.rol.nombre) })));
});

// ───────────────────────── Tracks y subtareas (kanban) ─────────────────────
// Rutas de dos segmentos (/tracks/:id, /subtareas/:id) no chocan con "/:id".

// PATCH /obras/tracks/:trackId - actualizar estado o responsable del track.
obrasRouter.patch("/tracks/:trackId", requireAuth, async (req, res) => {
  const trackId = Number(req.params.trackId);
  const { estadoActual, responsableId, justificacion } = req.body ?? {};

  const track = await prisma.obraTrack.findUnique({
    where: { id: trackId },
    include: {
      responsable: usuarioLite,
      obra: { select: { coordinadorId: true } },
      subtareas: {
        orderBy: { orden: "asc" },
        include: { archivos: { orderBy: { createdAt: "asc" } }, observaciones: { include: { autor: true }, orderBy: { createdAt: "asc" } } }
      }
    },
  });
  if (!track) return res.status(404).json({ error: "Track no encontrado" });

  const admin = puedeAdministrarObra(req.user);
  const coords = await coordinadoresEfectivos(track.obraId, track.obra.coordinadorId);
  const esCoordinadorEfectivo = !!req.user?.sub && coords.has(req.user.sub);
  const esResponsableTrack = track.responsableId != null && track.responsableId === req.user?.sub;

  // Asignar/quitar el responsable es la acción de "el subgerente/coordinador
  // asigna la línea de trabajo" — no puede hacerlo el propio responsable actual.
  if (responsableId !== undefined && !admin && !esCoordinadorEfectivo) {
    return res.status(403).json({ error: "Solo el subgerente o un coordinador del proyecto puede asignar el responsable de una línea de trabajo" });
  }
  if (estadoActual !== undefined && !admin && !esCoordinadorEfectivo && !esResponsableTrack) {
    return res.status(403).json({ error: "No tienes permisos para gestionar esta línea de trabajo" });
  }

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
    const msgJustificacion = justificacion ? ` Motivo: ${justificacion}` : "";
    await prisma.obraBitacora.create({
      data: {
        obraId: track.obraId,
        autorId: req.user!.sub,
        tipoEvento: "CAMBIO_ESTADO",
        mensaje: `Track ${track.tipo}: ${track.estadoActual} → ${estadoActual}.${msgJustificacion}`,
      },
    });
  }

  res.json(actualizado);
});

// DELETE /obras/tracks/:trackId - Elimina un tablero completo (cascada de
// subtareas, notas y adjuntos en BD; los archivos en disco se borran a mano).
// Acción sensible e irreversible: solo el rol "gerencia" puede ejecutarla (ni
// siquiera jefatura) — el frontend exige además una doble confirmación antes
// de llamar este endpoint. Queda registrada en la bitácora de la obra.
obrasRouter.delete("/tracks/:trackId", requireAuth, async (req, res) => {
  if (!esGerencia(req.user)) {
    return res.status(403).json({ error: "Solo gerencia puede eliminar un tablero" });
  }
  const trackId = Number(req.params.trackId);
  const track = await prisma.obraTrack.findUnique({
    where: { id: trackId },
    include: { subtareas: { include: { archivos: true } } },
  });
  if (!track) return res.status(404).json({ error: "Track no encontrado" });

  for (const sub of track.subtareas) {
    for (const archivo of sub.archivos) {
      const filePath = path.join(UPLOADS_DIR, path.basename(archivo.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  await prisma.obraTrack.delete({ where: { id: trackId } }); // cascada: subtareas, notas, archivos

  await prisma.obraBitacora.create({
    data: {
      obraId: track.obraId,
      autorId: req.user!.sub,
      tipoEvento: "TABLERO_ELIMINADO",
      mensaje: `Tablero "${track.tipo}" eliminado (${track.subtareas.length} tarea(s) perdidas).`,
    },
  });

  res.status(204).send();
});

// POST /obras/tracks/:trackId/subtareas - crear subtarea en el kanban del track.
obrasRouter.post("/tracks/:trackId/subtareas", requireAuth, async (req, res) => {
  const trackId = Number(req.params.trackId);
  const { titulo, estado, tipo, fechaVencimiento, fechaInicio, prioridad, asignadoId } = req.body ?? {};
  if (!titulo?.trim()) return res.status(400).json({ error: "El título de la tarea es requerido" });
  if (!fechaVencimiento) return res.status(400).json({ error: "La fecha de vencimiento es obligatoria" });

  if (estado !== undefined && !ESTADOS_SUBTAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_SUBTAREA.join(", ")}` });
  }
  if (prioridad !== undefined && !PRIORIDADES_SUBTAREA.includes(prioridad)) {
    return res.status(400).json({ error: `prioridad debe ser una de: ${PRIORIDADES_SUBTAREA.join(", ")}` });
  }

  const track = await prisma.obraTrack.findUnique({ where: { id: trackId }, include: { obra: { select: { coordinadorId: true } } } });
  if (!track) return res.status(404).json({ error: "Track no encontrado" });

  if (!(await puedeGestionarTrack(req.user, track.obraId, track.obra.coordinadorId, track.responsableId))) {
    return res.status(403).json({ error: "No tienes permisos para agregar tareas en esta línea de trabajo" });
  }

  const estadoFinal = estado ?? "POR_HACER";
  const max = await prisma.obraSubtarea.aggregate({ where: { trackId, estado: estadoFinal }, _max: { orden: true } });

  const subtarea = await prisma.obraSubtarea.create({
    data: {
      trackId,
      titulo: titulo.trim(),
      estado: estadoFinal,
      orden: (max._max.orden ?? -1) + 1,
      tipo: tipo?.trim() || null,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      prioridad: prioridad ?? "MEDIA",
      asignadoId: asignadoId ? Number(asignadoId) : null,
    },
    include: { asignado: usuarioLite },
  });

  // Registrar en bitácora
  await prisma.obraBitacora.create({
    data: {
      obraId: track.obraId,
      autorId: req.user!.sub,
      tipoEvento: "NUEVA_TAREA",
      mensaje: `Nueva tarea en track ${track.tipo}: "${subtarea.titulo}"`,
    },
  });

  await recalcularEstadoTrack(trackId, req.user!.sub);

  res.status(201).json(subtarea);
});

// PATCH /obras/subtareas/:id - mover (cambiar estado), renombrar, reordenar o
// editar las notas/observaciones.
obrasRouter.patch("/subtareas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, estado, orden, notas, tipo, fechaVencimiento, fechaInicio, prioridad, asignadoId, fechaEstimadaDesbloqueo } = req.body ?? {};
  if (estado !== undefined && !ESTADOS_SUBTAREA.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_SUBTAREA.join(", ")}` });
  }
  if (prioridad !== undefined && !PRIORIDADES_SUBTAREA.includes(prioridad)) {
    return res.status(400).json({ error: `prioridad debe ser una de: ${PRIORIDADES_SUBTAREA.join(", ")}` });
  }

  const existe = await prisma.obraSubtarea.findUnique({
    where: { id },
    include: { track: { include: { obra: { select: { coordinadorId: true } } } } },
  });
  if (!existe) return res.status(404).json({ error: "Subtarea no encontrada" });

  const puedeGestionar = await puedeGestionarTrack(req.user, existe.track.obraId, existe.track.obra.coordinadorId, existe.track.responsableId);
  if (!puedeGestionar) {
    // Sin autoridad sobre la línea de trabajo: solo se permite mover la
    // propia tarjeta (estado/orden/fecha de desbloqueo), y solo si el track
    // ya tiene un responsable asignado y la tarea es de este usuario.
    const camposEnviados = Object.keys(req.body ?? {});
    const soloMovimiento = camposEnviados.every((k) => ["estado", "orden", "fechaEstimadaDesbloqueo"].includes(k));
    const esAsignado = esAsignadoConTrackActivo(existe.track.responsableId, existe.asignadoId, req.user?.sub);
    if (!(soloMovimiento && esAsignado)) {
      return res.status(403).json({ error: "No tienes permisos para modificar esta tarea" });
    }
  }

  // Al bloquear una tarea es obligatorio dejar la fecha estimada de desbloqueo
  // (la que se está enviando ahora, o una que ya tuviera de un bloqueo previo).
  const estadoFinal = estado ?? existe.estado;
  const fechaDesbloqueoFinal = fechaEstimadaDesbloqueo !== undefined ? fechaEstimadaDesbloqueo : existe.fechaEstimadaDesbloqueo;
  if (estadoFinal === "BLOQUEADO" && !fechaDesbloqueoFinal) {
    return res.status(400).json({ error: "La fecha estimada de desbloqueo es obligatoria al bloquear una tarea" });
  }

  const actualizada = await prisma.obraSubtarea.update({
    where: { id },
    data: {
      ...(titulo !== undefined ? { titulo: String(titulo) } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(orden !== undefined ? { orden: Number(orden) } : {}),
      ...(notas !== undefined ? { notas: notas ? String(notas) : null } : {}),
      ...(tipo !== undefined ? { tipo: tipo ? String(tipo) : null } : {}),
      ...(fechaVencimiento !== undefined ? { fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null } : {}),
      ...(fechaInicio !== undefined ? { fechaInicio: fechaInicio ? new Date(fechaInicio) : null } : {}),
      ...(prioridad !== undefined ? { prioridad } : {}),
      ...(asignadoId !== undefined ? { asignadoId: asignadoId ? Number(asignadoId) : null } : {}),
      // La fecha de desbloqueo solo tiene sentido mientras la tarea está bloqueada:
      // al salir de BLOQUEADO se limpia automáticamente, sin importar qué se envió.
      fechaEstimadaDesbloqueo: estadoFinal === "BLOQUEADO"
        ? (fechaEstimadaDesbloqueo ? new Date(fechaEstimadaDesbloqueo) : existe.fechaEstimadaDesbloqueo)
        : null,
    },
    include: { archivos: { orderBy: { createdAt: "asc" } }, asignado: usuarioLite },
  });

  const huboCambioEstado = estado !== undefined && existe.estado !== estado;
  const huboCambioPrioridad = prioridad !== undefined && existe.prioridad !== prioridad;
  const huboCambioAsignado = asignadoId !== undefined && existe.asignadoId !== (asignadoId ? Number(asignadoId) : null);

  if (huboCambioEstado || huboCambioPrioridad || huboCambioAsignado) {
    const track = existe.track;
    if (track) {
      if (huboCambioEstado) {
        await prisma.obraBitacora.create({
          data: {
            obraId: track.obraId,
            autorId: req.user!.sub,
            tipoEvento: "CAMBIO_ESTADO",
            mensaje: `Tarea "${existe.titulo}" pasó a ${estado.replace("_", " ")}`,
          },
        });
      }
      if (huboCambioPrioridad) {
        await prisma.obraBitacora.create({
          data: {
            obraId: track.obraId,
            autorId: req.user!.sub,
            tipoEvento: "CAMBIO_PRIORIDAD",
            mensaje: `Tarea "${existe.titulo}" cambió su prioridad a ${prioridad}`,
          },
        });
      }
      if (huboCambioAsignado) {
        const nombreAsignado = actualizada.asignado?.nombre ?? "sin asignar";
        await prisma.obraBitacora.create({
          data: {
            obraId: track.obraId,
            autorId: req.user!.sub,
            tipoEvento: "REASIGNACION",
            mensaje: `Tarea "${existe.titulo}" fue asignada a ${nombreAsignado}`,
          },
        });
      }
    }
  }

  if (huboCambioEstado) {
    await recalcularEstadoTrack(existe.trackId, req.user!.sub);
  }

  res.json(actualizada);
});

// POST /obras/subtareas/:id/archivos - adjuntar documentación (base64 en JSON).
obrasRouter.post("/subtareas/:id/archivos", requireAuth, async (req, res) => {
  const subtareaId = Number(req.params.id);
  const { nombre, extension, archivoBase64 } = req.body ?? {};
  if (!nombre || !extension || !archivoBase64) {
    return res.status(400).json({ error: "nombre, extension y archivoBase64 son requeridos" });
  }

  const subtarea = await prisma.obraSubtarea.findUnique({
    where: { id: subtareaId },
    include: { track: { include: { obra: { select: { coordinadorId: true } } } } },
  });
  if (!subtarea) return res.status(404).json({ error: "Subtarea no encontrada" });

  const puedeGestionar = await puedeGestionarTrack(req.user, subtarea.track.obraId, subtarea.track.obra.coordinadorId, subtarea.track.responsableId);
  const esAsignado = esAsignadoConTrackActivo(subtarea.track.responsableId, subtarea.asignadoId, req.user?.sub);
  if (!puedeGestionar && !esAsignado) {
    return res.status(403).json({ error: "No tienes permisos para adjuntar archivos en esta tarea" });
  }

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
  const archivo = await prisma.obraSubtareaArchivo.findUnique({
    where: { id },
    include: { subtarea: { include: { track: { include: { obra: { select: { coordinadorId: true } } } } } } },
  });
  if (!archivo) return res.status(404).json({ error: "Archivo no encontrado" });

  const { track, ...subtarea } = archivo.subtarea;
  const puedeGestionar = await puedeGestionarTrack(req.user, track.obraId, track.obra.coordinadorId, track.responsableId);
  const esAsignado = esAsignadoConTrackActivo(track.responsableId, subtarea.asignadoId, req.user?.sub);
  if (!puedeGestionar && !esAsignado) {
    return res.status(403).json({ error: "No tienes permisos para eliminar este archivo" });
  }

  const filePath = path.join(UPLOADS_DIR, path.basename(archivo.url));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.obraSubtareaArchivo.delete({ where: { id } });
  res.status(204).send();
});

// POST /obras/subtareas/:id/observaciones - Añadir una nota a la subtarea
obrasRouter.post("/subtareas/:id/observaciones", requireAuth, async (req, res) => {
  const subtareaId = Number(req.params.id);
  const { contenido } = req.body ?? {};
  if (!contenido || !String(contenido).trim()) {
    return res.status(400).json({ error: "El contenido de la observación es requerido" });
  }

  const autorId = req.user?.sub ? Number(req.user.sub) : undefined;
  if (!autorId) return res.status(401).json({ error: "No autenticado" });

  try {
    const subtarea = await prisma.obraSubtarea.findUnique({
      where: { id: subtareaId },
      include: { track: true }
    });
    
    if (!subtarea) return res.status(404).json({ error: "Subtarea no encontrada" });

    const obs = await prisma.obraSubtareaNota.create({
      data: { subtareaId, autorId, contenido: String(contenido).trim() },
      include: { autor: { select: { id: true, nombre: true } } }
    });

    const truncado = String(contenido).trim();
    const mensajeObs = truncado.length > 100 ? truncado.substring(0, 100) + "..." : truncado;

    await prisma.obraBitacora.create({
      data: {
        obraId: subtarea.track.obraId,
        autorId,
        tipoEvento: "OBSERVACION",
        mensaje: `Añadió una observación en "${subtarea.titulo}": "${mensajeObs}"`
      }
    });

    res.status(201).json(obs);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Error al guardar la observación" });
  }
});

// DELETE /obras/observaciones/:id - Eliminar una nota
obrasRouter.delete("/observaciones/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const obs = await prisma.obraSubtareaNota.findUnique({ where: { id } });
  if (!obs) return res.status(404).json({ error: "Observación no encontrada" });

  const puedeAdministrar = puedeAdministrarObra(req.user);
  const currentUserId = req.user?.sub ? Number(req.user.sub) : undefined;
  if (obs.autorId !== currentUserId && !puedeAdministrar) {
    return res.status(403).json({ error: "No tienes permiso para eliminar esta observación" });
  }

  await prisma.obraSubtareaNota.delete({ where: { id } });
  res.status(204).send();
});

// DELETE /obras/subtareas/:id
obrasRouter.delete("/subtareas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existe = await prisma.obraSubtarea.findUnique({
    where: { id },
    include: { track: { include: { obra: { select: { coordinadorId: true } } } } },
  });
  if (!existe) return res.status(404).json({ error: "Subtarea no encontrada" });

  if (!(await puedeGestionarTrack(req.user, existe.track.obraId, existe.track.obra.coordinadorId, existe.track.responsableId))) {
    return res.status(403).json({ error: "No tienes permisos para eliminar esta tarea" });
  }

  await prisma.obraSubtarea.delete({ where: { id } });
  await recalcularEstadoTrack(existe.trackId, req.user!.sub);
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
            include: {
              archivos: { orderBy: { createdAt: "asc" } },
              observaciones: { include: { autor: usuarioLite }, orderBy: { createdAt: "asc" } },
              asignado: usuarioLite,
            },
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
      coordinadoresExtra: {
        where: { activo: true, OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: new Date() } }] },
        include: { coordinador: usuarioLite },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const conAvance = { ...obra, avance: FASE_AVANCE[obra.faseGlobal] ?? 0 };
  res.json(puedeVerCostos(req.user) ? conAvance : redactarCostos(conAvance));
});

const FASES_OBRA = ["INICIO", "GESTION", "EJECUCION", "CERRADO"] as const;

// PATCH /obras/:id - asignar responsables (subgerente/coordinador), fase o
// presupuesto. Jefatura/gerencia tiene acceso total. El coordinador asignado
// puede cambiar la fase o la fecha de entrega.
obrasRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { subgerenteId, coordinadorId, faseGlobal, presupuesto, fechaEntrega } = req.body ?? {};
  
  const anterior = await prisma.obra.findUnique({ where: { id }, include: { coordinador: usuarioLite } });
  if (!anterior) return res.status(404).json({ error: "Obra no encontrada" });

  const esAdmin = puedeAdministrarObra(req.user);
  const esCoordinador = req.user?.sub === anterior.coordinadorId;

  if (!esAdmin && !esCoordinador) {
    return res.status(403).json({ error: "No tienes permisos para editar esta obra" });
  }

  // Si es coordinador (y no admin), rechazar cambios que no sean de fase o fecha
  if (!esAdmin && esCoordinador) {
    if (subgerenteId !== undefined || coordinadorId !== undefined || presupuesto !== undefined) {
      return res.status(403).json({ error: "Como coordinador, solo puedes modificar la fase y fecha de entrega" });
    }
  }

  if (faseGlobal !== undefined && !FASES_OBRA.includes(faseGlobal)) {
    return res.status(400).json({ error: `faseGlobal debe ser una de: ${FASES_OBRA.join(", ")}` });
  }

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

  // Deja rastro si la fase global cambia
  if (faseGlobal !== undefined && anterior.faseGlobal !== faseGlobal) {
    await prisma.obraBitacora.create({
      data: {
        obraId: id,
        autorId: req.user!.sub,
        tipoEvento: "CAMBIO_ESTADO",
        mensaje: `Fase del proyecto cambiada: ${anterior.faseGlobal} → ${faseGlobal}.`,
      },
    });
  }

  res.json(obra);
});

const TIPOS_TRANSFERENCIA = ["DEFINITIVA", "TEMPORAL", "PARALELO"] as const;

// POST /obras/:id/transferencias - transferir o compartir la coordinación del
// proyecto. DEFINITIVA reemplaza a Obra.coordinadorId (como el PATCH de
// arriba); TEMPORAL/PARALELO agregan un co-coordinador con autoridad plena
// sobre todos los tracks mientras esté vigente (ver coordinadoresEfectivos).
// Solo el subgerente/gerencia/jefatura o el coordinador principal actual
// pueden transferir — un co-coordinador temporal no puede volver a transferir.
obrasRouter.post("/:id/transferencias", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { coordinadorId, tipo, vigenteHasta } = req.body ?? {};

  if (!coordinadorId) return res.status(400).json({ error: "coordinadorId es requerido" });
  if (!TIPOS_TRANSFERENCIA.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser una de: ${TIPOS_TRANSFERENCIA.join(", ")}` });
  }

  const obra = await prisma.obra.findUnique({ where: { id }, include: { coordinador: usuarioLite } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const esAdmin = puedeAdministrarObra(req.user);
  const esCoordinadorPrincipal = req.user?.sub === obra.coordinadorId;
  if (!esAdmin && !esCoordinadorPrincipal) {
    return res.status(403).json({ error: "Solo el subgerente o el coordinador principal puede transferir el proyecto" });
  }

  const nuevoCoordinador = await prisma.usuario.findUnique({ where: { id: Number(coordinadorId) }, select: { id: true, nombre: true } });
  if (!nuevoCoordinador) return res.status(404).json({ error: "Usuario destinatario no encontrado" });

  if (tipo === "DEFINITIVA") {
    const actualizada = await prisma.obra.update({
      where: { id },
      data: { coordinadorId: nuevoCoordinador.id },
      include: { subgerente: usuarioLite, coordinador: usuarioLite },
    });
    await prisma.obraBitacora.create({
      data: {
        obraId: id,
        autorId: req.user!.sub,
        tipoEvento: "TRANSFERENCIA",
        mensaje: `Transferencia definitiva: ${obra.coordinador?.nombre ?? "sin asignar"} → ${nuevoCoordinador.nombre}.`,
      },
    });
    return res.json(actualizada);
  }

  const extra = await prisma.obraCoordinadorExtra.create({
    data: {
      obraId: id,
      coordinadorId: nuevoCoordinador.id,
      tipo,
      vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : null,
    },
    include: { coordinador: usuarioLite },
  });

  const etiqueta = tipo === "TEMPORAL" ? "temporal" : "en paralelo";
  const hasta = vigenteHasta ? ` hasta ${new Date(vigenteHasta).toLocaleDateString("es-CL")}` : " (sin fecha de término)";
  await prisma.obraBitacora.create({
    data: {
      obraId: id,
      autorId: req.user!.sub,
      tipoEvento: "TRANSFERENCIA",
      mensaje: `${nuevoCoordinador.nombre} agregado como coordinador ${etiqueta}${hasta}.`,
    },
  });

  res.status(201).json(extra);
});

// DELETE /obras/:id/coordinadores-extra/:extraId - retira un co-coordinador
// (temporal/paralelo) antes de su vencimiento natural.
obrasRouter.delete("/:id/coordinadores-extra/:extraId", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const extraId = Number(req.params.extraId);

  const obra = await prisma.obra.findUnique({ where: { id } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const esAdmin = puedeAdministrarObra(req.user);
  const esCoordinadorPrincipal = req.user?.sub === obra.coordinadorId;
  if (!esAdmin && !esCoordinadorPrincipal) {
    return res.status(403).json({ error: "Solo el subgerente o el coordinador principal puede retirar un co-coordinador" });
  }

  const extra = await prisma.obraCoordinadorExtra.findUnique({ where: { id: extraId }, include: { coordinador: usuarioLite } });
  if (!extra || extra.obraId !== id) return res.status(404).json({ error: "Registro de co-coordinación no encontrado" });

  await prisma.obraCoordinadorExtra.update({ where: { id: extraId }, data: { activo: false } });
  await prisma.obraBitacora.create({
    data: {
      obraId: id,
      autorId: req.user!.sub,
      tipoEvento: "TRANSFERENCIA",
      mensaje: `Coordinación ${extra.tipo === "TEMPORAL" ? "temporal" : "en paralelo"} de ${extra.coordinador.nombre} finalizada.`,
    },
  });

  res.status(204).send();
});

// DELETE /obras/:id - eliminar obra (cascada de tracks/subtareas/bitácora).
// Solo jefatura/gerencia.
obrasRouter.delete("/:id", requireAuth, async (req, res) => {
  if (!puedeAdministrarObra(req.user)) {
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

// GET /obras/:id/materiales - Obtener solicitudes de materiales de la obra
obrasRouter.get("/:id/materiales", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const solicitudes = await prisma.solicitudMaterial.findMany({
    where: { obraId: id },
    include: {
      solicitante: usuarioLite,
      items: true
    },
    orderBy: { fechaCreacion: "desc" }
  });

  if (puedeVerCostos(req.user)) return res.json(solicitudes);

  // Redacta a `null` (no se elimina la clave) para no romper los `Number(...)`
  // sin guarda del frontend, que interpretan `null` como 0 de forma segura.
  const redactadas = solicitudes.map((s) => ({
    ...s,
    costoTotal: null,
    items: s.items.map((it) => ({ ...it, precioUnitario: null })),
  }));
  res.json(redactadas);
});

const CLIMAS_VALIDOS = ["DESPEJADO", "NUBLADO", "LLUVIA", "VIENTO"] as const;

// GET /obras/:id/reportes-diarios - parte diario de terreno (rápido, no texto
// libre extenso), opcionalmente filtrado por rango de fechas. Cualquier
// usuario autenticado del proyecto puede leerlos (se usa también para el PDF).
obrasRouter.get("/:id/reportes-diarios", requireAuth, async (req, res) => {
  const obraId = Number(req.params.id);
  const { desde, hasta } = req.query;

  const reportes = await prisma.reporteDiario.findMany({
    where: {
      obraId,
      ...(desde || hasta
        ? {
            fecha: {
              ...(desde ? { gte: new Date(String(desde)) } : {}),
              ...(hasta ? { lte: new Date(String(hasta)) } : {}),
            },
          }
        : {}),
    },
    include: { autor: usuarioLite },
    orderBy: { fecha: "desc" },
  });
  res.json(reportes);
});

// POST /obras/:id/reportes-diarios - cualquier usuario autenticado registra
// su propio parte del día (no requiere ser coordinador ni responsable de
// track: es un registro de terreno, no una acción de gestión del kanban).
obrasRouter.post("/:id/reportes-diarios", requireAuth, async (req, res) => {
  const obraId = Number(req.params.id);
  const { fecha, trackId, personal, clima, horasTrabajadas, trabajoRealizado, materiales, observaciones } = req.body ?? {};

  if (!trabajoRealizado?.trim()) return res.status(400).json({ error: "trabajoRealizado es requerido" });
  if (clima !== undefined && clima !== null && !CLIMAS_VALIDOS.includes(clima)) {
    return res.status(400).json({ error: `clima debe ser uno de: ${CLIMAS_VALIDOS.join(", ")}` });
  }

  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  if (trackId) {
    const track = await prisma.obraTrack.findUnique({ where: { id: Number(trackId) } });
    if (!track || track.obraId !== obraId) return res.status(400).json({ error: "trackId inválido para esta obra" });
  }

  const reporte = await prisma.reporteDiario.create({
    data: {
      obraId,
      autorId: req.user!.sub,
      fecha: fecha ? new Date(fecha) : new Date(),
      trackId: trackId ? Number(trackId) : null,
      personal: personal !== undefined && personal !== null && personal !== "" ? Number(personal) : null,
      clima: clima || null,
      horasTrabajadas: horasTrabajadas !== undefined && horasTrabajadas !== null && horasTrabajadas !== "" ? Number(horasTrabajadas) : null,
      trabajoRealizado: trabajoRealizado.trim(),
      materiales: materiales?.trim() || null,
      observaciones: observaciones?.trim() || null,
    },
    include: { autor: usuarioLite },
  });
  res.status(201).json(reporte);
});

// PATCH /obras/reportes-diarios/:id - solo el autor o admin puede editar.
obrasRouter.patch("/reportes-diarios/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { fecha, trackId, personal, clima, horasTrabajadas, trabajoRealizado, materiales, observaciones } = req.body ?? {};

  const existente = await prisma.reporteDiario.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "Reporte no encontrado" });
  if (existente.autorId !== req.user?.sub && !puedeAdministrarObra(req.user)) {
    return res.status(403).json({ error: "Solo el autor puede editar este reporte" });
  }
  if (clima !== undefined && clima !== null && !CLIMAS_VALIDOS.includes(clima)) {
    return res.status(400).json({ error: `clima debe ser uno de: ${CLIMAS_VALIDOS.join(", ")}` });
  }

  const reporte = await prisma.reporteDiario.update({
    where: { id },
    data: {
      ...(fecha !== undefined ? { fecha: new Date(fecha) } : {}),
      ...(trackId !== undefined ? { trackId: trackId ? Number(trackId) : null } : {}),
      ...(personal !== undefined ? { personal: personal !== null && personal !== "" ? Number(personal) : null } : {}),
      ...(clima !== undefined ? { clima: clima || null } : {}),
      ...(horasTrabajadas !== undefined ? { horasTrabajadas: horasTrabajadas !== null && horasTrabajadas !== "" ? Number(horasTrabajadas) : null } : {}),
      ...(trabajoRealizado !== undefined ? { trabajoRealizado: String(trabajoRealizado).trim() } : {}),
      ...(materiales !== undefined ? { materiales: materiales?.trim() || null } : {}),
      ...(observaciones !== undefined ? { observaciones: observaciones?.trim() || null } : {}),
    },
    include: { autor: usuarioLite },
  });
  res.json(reporte);
});

// DELETE /obras/reportes-diarios/:id - solo el autor o admin.
obrasRouter.delete("/reportes-diarios/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.reporteDiario.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "Reporte no encontrado" });
  if (existente.autorId !== req.user?.sub && !puedeAdministrarObra(req.user)) {
    return res.status(403).json({ error: "Solo el autor puede eliminar este reporte" });
  }
  await prisma.reporteDiario.delete({ where: { id } });
  res.status(204).send();
});

// POST /obras - Crear nueva obra
obrasRouter.post("/", requireAuth, async (req, res) => {
  const { codigoObra, nombre, cliente, tipoObra, tipoObraDetalle, presupuesto, subgerenteId, coordinadorId, fechaEntrega, tracks } = req.body ?? {};

  if (!codigoObra || !nombre || !cliente || !tipoObra) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (tipoObra === "OTRO" && !tipoObraDetalle?.trim()) {
    return res.status(400).json({ error: "Debes describir el tipo de proyecto cuando eliges \"Otro\"" });
  }

  let tracksNormalizados: { tipo: string; nombre: string | null }[];
  try {
    tracksNormalizados = normalizarTracks(tracks);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  // Las líneas de trabajo ya no se inicializan automáticamente: el usuario las
  // define en el formulario de creación (puede dejarlas vacías y agregarlas
  // después desde dentro del proyecto vía POST /:id/tracks).
  const obra = await prisma.obra.create({
    data: {
      codigoObra,
      nombre,
      cliente,
      tipoObra,
      tipoObraDetalle: tipoObra === "OTRO" ? tipoObraDetalle.trim() : null,
      presupuesto: presupuesto ? Number(presupuesto) : null,
      subgerenteId: subgerenteId ? Number(subgerenteId) : null,
      coordinadorId: coordinadorId ? Number(coordinadorId) : null,
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      tracks: {
        create: tracksNormalizados.map((t) => ({ tipo: t.tipo, nombre: t.nombre, estadoActual: "NO_INICIADO" })),
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

// POST /obras/:id/tracks - agrega una línea de trabajo (track) a una obra ya
// existente. Se puede usar tanto una de las predefinidas como una "OTRO"
// personalizada con nombre libre.
obrasRouter.post("/:id/tracks", requireAuth, async (req, res) => {
  const obraId = Number(req.params.id);
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) return res.status(404).json({ error: "Obra no encontrada" });

  const admin = puedeAdministrarObra(req.user);
  const coords = await coordinadoresEfectivos(obraId, obra.coordinadorId);
  const esCoordinadorEfectivo = !!req.user?.sub && coords.has(req.user.sub);
  if (!admin && !esCoordinadorEfectivo) {
    return res.status(403).json({ error: "Solo el subgerente o un coordinador del proyecto puede agregar líneas de trabajo" });
  }

  let tracksNormalizados: { tipo: string; nombre: string | null }[];
  try {
    tracksNormalizados = normalizarTracks([req.body]);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  const [{ tipo, nombre }] = tracksNormalizados;

  const track = await prisma.obraTrack.create({
    data: { obraId, tipo, nombre, estadoActual: "NO_INICIADO" },
    include: { responsable: usuarioLite, subtareas: true },
  });

  await prisma.obraBitacora.create({
    data: {
      obraId,
      autorId: req.user!.sub,
      tipoEvento: "CREACION",
      mensaje: `Línea de trabajo agregada: ${nombre ?? tipo}.`,
    },
  });

  res.status(201).json(track);
});
