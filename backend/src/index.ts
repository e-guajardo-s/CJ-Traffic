import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { requireAuth, signToken } from "./auth";
import { iotRouter } from "./routes/iot";
import { firmwareRouter } from "./routes/firmware";
import { adminRouter } from "./routes/admin";
import { inventarioRouter } from "./routes/inventario";
import { proyectosRouter } from "./routes/proyectos";

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
  res.json(Object.fromEntries(permisos.map((p) => [p.modulo.clave, p.nivel])));
});

app.use("/iot", iotRouter);
app.use("/iot/inventario", inventarioRouter);
app.use("/firmware", firmwareRouter);
app.use("/admin", adminRouter);
app.use("/proyectos", proyectosRouter);

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
