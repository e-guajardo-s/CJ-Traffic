import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { requireAuth, requireModulo, signToken } from "./auth";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/health", async (_req, res) => {
  const roles = await prisma.rol.findMany();
  res.json({ status: "ok", roles });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email y password son requeridos" });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });
  if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = signToken({ sub: usuario.id, rolId: usuario.rolId, rolNombre: usuario.rol.nombre });
  res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol.nombre } });
});

app.get("/me/permissions", requireAuth, async (req, res) => {
  const permisos = await prisma.rolModuloPermiso.findMany({
    where: { rolId: req.user!.rolId },
    include: { modulo: true },
  });
  res.json(
    Object.fromEntries(permisos.map((p) => [p.modulo.clave, p.nivel])),
  );
});

app.get("/iot/gateways", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const cruces = await prisma.cruce.findMany({
    include: { gateway: true },
    orderBy: { codigo: "asc" },
  });
  res.json(cruces);
});

app.get("/firmware/programaciones", requireAuth, requireModulo("firmware", "LECTURA"), async (_req, res) => {
  const programaciones = await prisma.programacion.findMany({
    include: { cruce: true, subidoPor: true, feedbacks: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(programaciones);
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
