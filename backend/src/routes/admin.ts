import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const adminRouter = Router();

adminRouter.get("/roles", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const roles = await prisma.rol.findMany({ orderBy: { nombre: "asc" } });
  res.json(roles);
});

adminRouter.get("/usuarios", requireAuth, requireModulo("admin", "ESCRITURA"), async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    include: { rol: true },
    orderBy: { nombre: "asc" },
  });
  res.json(usuarios.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol.nombre })));
});

adminRouter.post("/usuarios", requireAuth, requireModulo("admin", "ESCRITURA"), async (req, res) => {
  const { nombre, email, password, rolId } = req.body ?? {};
  if (!nombre || !email || !password || !rolId) {
    return res.status(400).json({ error: "nombre, email, password y rolId son requeridos" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return res.status(409).json({ error: "Ya existe un usuario con ese email" });

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, passwordHash, rolId: Number(rolId) },
    include: { rol: true },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "usuario.crear",
    entidad: "Usuario",
    entidadId: usuario.id,
    detalle: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre },
  });

  res.status(201).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre });
});

// El glosario técnico vive en el módulo Desarrollo (iot): ver routes/proyectos.ts.
