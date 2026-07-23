import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const adminRouter = Router();

const usuarioConRolesYAreas = {
  roles: { include: { rol: true } },
  areas: { include: { area: true } },
};

function serializarUsuario(u: {
  id: number;
  nombre: string;
  email: string;
  roles: { rol: { nombre: string } }[];
  areas: { area: { nombre: string } }[];
}) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    roles: u.roles.map((r) => r.rol.nombre),
    areas: u.areas.map((a) => a.area.nombre),
  };
}

adminRouter.get("/roles", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const roles = await prisma.rol.findMany({ orderBy: { nombre: "asc" } });
  res.json(roles);
});

adminRouter.get("/areas", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const areas = await prisma.area.findMany({ orderBy: { nombre: "asc" } });
  res.json(areas);
});

adminRouter.post("/areas", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const { nombre } = req.body ?? {};
  if (!nombre?.trim()) return res.status(400).json({ error: "nombre es requerido" });

  const existente = await prisma.area.findUnique({ where: { nombre: nombre.trim() } });
  if (existente) return res.status(409).json({ error: "Ya existe un área con ese nombre" });

  const area = await prisma.area.create({ data: { nombre: nombre.trim() } });
  await registrarBitacora({ autorId: req.user!.sub, accion: "area.crear", entidad: "Area", entidadId: area.id, detalle: { nombre: area.nombre } });
  res.status(201).json(area);
});

adminRouter.patch("/areas/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre } = req.body ?? {};
  if (!nombre?.trim()) return res.status(400).json({ error: "nombre es requerido" });

  const area = await prisma.area.update({ where: { id }, data: { nombre: nombre.trim() } });
  await registrarBitacora({ autorId: req.user!.sub, accion: "area.editar", entidad: "Area", entidadId: area.id, detalle: { nombre: area.nombre } });
  res.json(area);
});

adminRouter.delete("/areas/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const area = await prisma.area.findUnique({ where: { id }, include: { usuarios: true } });
  if (!area) return res.status(404).json({ error: "Área no encontrada" });
  if (area.usuarios.length > 0) {
    return res.status(400).json({ error: `El área tiene ${area.usuarios.length} usuario(s) asignado(s). Quítalos antes de eliminarla.` });
  }

  await prisma.area.delete({ where: { id } });
  await registrarBitacora({ autorId: req.user!.sub, accion: "area.eliminar", entidad: "Area", entidadId: id, detalle: { nombre: area.nombre } });
  res.status(204).send();
});

adminRouter.get("/usuarios", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    include: usuarioConRolesYAreas,
    orderBy: { nombre: "asc" },
  });
  res.json(usuarios.map(serializarUsuario));
});

adminRouter.post("/usuarios", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const { nombre, email, password, rolIds, areaIds } = req.body ?? {};
  const rolIdsNum: number[] = Array.isArray(rolIds) ? rolIds.map(Number) : [];
  const areaIdsNum: number[] = Array.isArray(areaIds) ? areaIds.map(Number) : [];

  if (!nombre || !email || !password || rolIdsNum.length === 0) {
    return res.status(400).json({ error: "nombre, email, password y al menos un rol son requeridos" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return res.status(409).json({ error: "Ya existe un usuario con ese email" });

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email,
      passwordHash,
      roles: { create: rolIdsNum.map((rolId) => ({ rolId })) },
      areas: { create: areaIdsNum.map((areaId) => ({ areaId })) },
    },
    include: usuarioConRolesYAreas,
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "usuario.crear",
    entidad: "Usuario",
    entidadId: usuario.id,
    detalle: { nombre: usuario.nombre, email: usuario.email, roles: usuario.roles.map((r) => r.rol.nombre) },
  });

  res.status(201).json(serializarUsuario(usuario));
});

// PATCH /admin/usuarios/:id - editar nombre/email/roles/áreas y, opcionalmente,
// resetear la contraseña. Reemplaza el set completo de roles/áreas (no es un
// PATCH incremental) para que el modal de edición sea simple: manda el estado
// final de los chips seleccionados.
adminRouter.patch("/usuarios/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, email, password, rolIds, areaIds } = req.body ?? {};

  const existente = await prisma.usuario.findUnique({ where: { id }, include: usuarioConRolesYAreas });
  if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

  if (rolIds !== undefined) {
    const rolIdsNum: number[] = Array.isArray(rolIds) ? rolIds.map(Number) : [];
    if (rolIdsNum.length === 0) return res.status(400).json({ error: "El usuario debe tener al menos un rol" });

    // Si se está quitando el rol "gerencia" de este usuario, verificar que quede
    // al menos otro usuario con ese rol — el sistema no puede quedar sin gerencia.
    const rolGerencia = await prisma.rol.findUnique({ where: { nombre: "gerencia" } });
    const teniaGerencia = existente.roles.some((r) => r.rol.nombre === "gerencia");
    const tendraGerencia = rolGerencia ? rolIdsNum.includes(rolGerencia.id) : false;
    if (teniaGerencia && !tendraGerencia) {
      const otrosConGerencia = await prisma.usuarioRol.count({
        where: { rolId: rolGerencia!.id, usuarioId: { not: id } },
      });
      if (otrosConGerencia === 0) {
        return res.status(400).json({ error: "No puedes quitar el último usuario con rol gerencia del sistema" });
      }
    }
  }

  if (email !== undefined && email !== existente.email) {
    const otroConEmail = await prisma.usuario.findUnique({ where: { email } });
    if (otroConEmail) return res.status(409).json({ error: "Ya existe un usuario con ese email" });
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  if (password && String(password).length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      ...(rolIds !== undefined
        ? { roles: { deleteMany: {}, create: (rolIds as unknown[]).map((rolId) => ({ rolId: Number(rolId) })) } }
        : {}),
      ...(areaIds !== undefined
        ? { areas: { deleteMany: {}, create: (areaIds as unknown[]).map((areaId) => ({ areaId: Number(areaId) })) } }
        : {}),
    },
    include: usuarioConRolesYAreas,
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "usuario.editar",
    entidad: "Usuario",
    entidadId: usuario.id,
    detalle: { nombre: usuario.nombre, email: usuario.email, roles: usuario.roles.map((r) => r.rol.nombre), passwordReseteada: !!password },
  });

  res.json(serializarUsuario(usuario));
});

adminRouter.delete("/usuarios/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) {
    return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
  }

  const existente = await prisma.usuario.findUnique({ where: { id }, include: { roles: { include: { rol: true } } } });
  if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });

  const eraGerencia = existente.roles.some((r) => r.rol.nombre === "gerencia");
  if (eraGerencia) {
    const rolGerencia = await prisma.rol.findUnique({ where: { nombre: "gerencia" } });
    const otrosConGerencia = await prisma.usuarioRol.count({ where: { rolId: rolGerencia!.id, usuarioId: { not: id } } });
    if (otrosConGerencia === 0) {
      return res.status(400).json({ error: "No puedes eliminar al último usuario con rol gerencia del sistema" });
    }
  }

  await prisma.usuario.delete({ where: { id } });
  await registrarBitacora({ autorId: req.user!.sub, accion: "usuario.eliminar", entidad: "Usuario", entidadId: id, detalle: { nombre: existente.nombre, email: existente.email } });
  res.status(204).send();
});

// ────────── Avisos (banners/popups del panel de administración) ──────────

adminRouter.get("/avisos", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const avisos = await prisma.aviso.findMany({
    include: { autor: { select: { id: true, nombre: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(avisos);
});

const TIPOS_AVISO = ["INFO", "MANTENCION", "ADVERTENCIA", "URGENTE"] as const;
const PRESENTACIONES_AVISO = ["BANNER", "POPUP"] as const;
const AUDIENCIAS_AVISO = ["TODOS", "AREA", "ROL"] as const;

adminRouter.post("/avisos", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const { titulo, cuerpo, tipo, presentacion, audienciaTipo, audienciaRef, fechaProgramada, vigenteHasta } = req.body ?? {};

  if (!titulo?.trim() || !cuerpo?.trim()) {
    return res.status(400).json({ error: "titulo y cuerpo son requeridos" });
  }
  if (tipo && !TIPOS_AVISO.includes(tipo)) return res.status(400).json({ error: "tipo inválido" });
  if (presentacion && !PRESENTACIONES_AVISO.includes(presentacion)) return res.status(400).json({ error: "presentacion inválida" });
  if (audienciaTipo && !AUDIENCIAS_AVISO.includes(audienciaTipo)) return res.status(400).json({ error: "audienciaTipo inválido" });
  if (audienciaTipo && audienciaTipo !== "TODOS" && !audienciaRef?.trim()) {
    return res.status(400).json({ error: "audienciaRef es requerido cuando audienciaTipo no es TODOS" });
  }

  const aviso = await prisma.aviso.create({
    data: {
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      tipo: tipo ?? "INFO",
      presentacion: presentacion ?? "BANNER",
      audienciaTipo: audienciaTipo ?? "TODOS",
      audienciaRef: audienciaTipo && audienciaTipo !== "TODOS" ? audienciaRef.trim() : null,
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
      vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : null,
      autorId: req.user!.sub,
    },
    include: { autor: { select: { id: true, nombre: true } } },
  });

  await registrarBitacora({ autorId: req.user!.sub, accion: "aviso.crear", entidad: "Aviso", entidadId: aviso.id, detalle: { titulo: aviso.titulo, tipo: aviso.tipo } });
  res.status(201).json(aviso);
});

adminRouter.patch("/avisos/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, cuerpo, tipo, presentacion, audienciaTipo, audienciaRef, fechaProgramada, vigenteHasta, activo } = req.body ?? {};

  if (tipo && !TIPOS_AVISO.includes(tipo)) return res.status(400).json({ error: "tipo inválido" });
  if (presentacion && !PRESENTACIONES_AVISO.includes(presentacion)) return res.status(400).json({ error: "presentacion inválida" });
  if (audienciaTipo && !AUDIENCIAS_AVISO.includes(audienciaTipo)) return res.status(400).json({ error: "audienciaTipo inválido" });

  const existente = await prisma.aviso.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "Aviso no encontrado" });

  const aviso = await prisma.aviso.update({
    where: { id },
    data: {
      ...(titulo !== undefined ? { titulo: String(titulo).trim() } : {}),
      ...(cuerpo !== undefined ? { cuerpo: String(cuerpo).trim() } : {}),
      ...(tipo !== undefined ? { tipo } : {}),
      ...(presentacion !== undefined ? { presentacion } : {}),
      ...(audienciaTipo !== undefined ? { audienciaTipo, audienciaRef: audienciaTipo === "TODOS" ? null : (audienciaRef?.trim() ?? existente.audienciaRef) } : {}),
      ...(fechaProgramada !== undefined ? { fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null } : {}),
      ...(vigenteHasta !== undefined ? { vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : null } : {}),
      ...(activo !== undefined ? { activo: !!activo } : {}),
    },
    include: { autor: { select: { id: true, nombre: true } } },
  });

  await registrarBitacora({ autorId: req.user!.sub, accion: "aviso.editar", entidad: "Aviso", entidadId: aviso.id, detalle: { titulo: aviso.titulo, activo: aviso.activo } });
  res.json(aviso);
});

adminRouter.delete("/avisos/:id", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.aviso.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "Aviso no encontrado" });

  await prisma.aviso.delete({ where: { id } });
  await registrarBitacora({ autorId: req.user!.sub, accion: "aviso.eliminar", entidad: "Aviso", entidadId: id, detalle: { titulo: existente.titulo } });
  res.status(204).send();
});

// El glosario técnico vive en el módulo Desarrollo (iot): ver routes/proyectos.ts.
