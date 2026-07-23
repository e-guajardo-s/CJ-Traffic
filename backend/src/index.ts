import express from "express";
import bcrypt from "bcryptjs";
import path from "path";
import { prisma } from "./prisma";
import { requireAuth, signToken } from "./auth";
import { iotRouter } from "./routes/iot";
import { firmwareRouter } from "./routes/firmware";
import { adminRouter } from "./routes/admin";
import { inventarioRouter } from "./routes/inventario";
import { proyectosRouter } from "./routes/proyectos";
import { obrasRouter } from "./routes/obras";
import { subcontratosRouter } from "./routes/subcontratos";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "15mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/health", async (_req, res) => {
  const roles = await prisma.rol.findMany();
  res.json({ status: "ok", roles });
});

const NIVEL_RANGO: Record<string, number> = { OCULTO: 0, LECTURA: 1, ESCRITURA: 2 };

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email y password son requeridos" });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { roles: { include: { rol: true } }, areas: { include: { area: true } } },
  });
  if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const roles = usuario.roles.map((r) => r.rol.nombre);
  const rolIds = usuario.roles.map((r) => r.rolId);
  const areas = usuario.areas.map((a) => a.area.nombre);
  const token = signToken({ sub: usuario.id, rolIds, roles });
  res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, roles, areas } });
});

// Agrega el permiso de cada módulo por el nivel MÁXIMO entre todos los roles
// del usuario (un usuario multi-rol accede si cualquiera de sus roles lo permite).
app.get("/me/permissions", requireAuth, async (req, res) => {
  const permisos = await prisma.rolModuloPermiso.findMany({
    where: { rolId: { in: req.user!.rolIds } },
    include: { modulo: true },
  });
  const porModulo: Record<string, string> = {};
  for (const p of permisos) {
    const actual = porModulo[p.modulo.clave] ?? "OCULTO";
    if (NIVEL_RANGO[p.nivel] > NIVEL_RANGO[actual]) porModulo[p.modulo.clave] = p.nivel;
  }
  res.json(porModulo);
});

// Avisos vigentes para el usuario autenticado: TODOS, o dirigidos a un área
// o rol que el usuario tenga. Usado por el feed de Inicio (banners + popups).
app.get("/me/avisos", requireAuth, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.sub },
    include: { areas: { include: { area: true } } },
  });
  const areas = usuario?.areas.map((a) => a.area.nombre) ?? [];

  const avisos = await prisma.aviso.findMany({
    where: {
      activo: true,
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: new Date() } }],
    },
    include: { autor: { select: { id: true, nombre: true } } },
    orderBy: [{ createdAt: "desc" }],
  });

  const visibles = avisos.filter((a) => {
    if (a.audienciaTipo === "TODOS") return true;
    if (a.audienciaTipo === "ROL") return req.user!.roles.includes(a.audienciaRef ?? "");
    if (a.audienciaTipo === "AREA") return areas.includes(a.audienciaRef ?? "");
    return false;
  });

  const ORDEN_TIPO: Record<string, number> = { URGENTE: 0, ADVERTENCIA: 1, MANTENCION: 2, INFO: 3 };
  visibles.sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9));

  res.json(visibles);
});

app.use("/iot", iotRouter);
app.use("/iot/inventario", inventarioRouter);
app.use("/firmware", firmwareRouter);
app.use("/admin", adminRouter);
app.use("/proyectos", proyectosRouter);
app.use("/proyectos-empresa", obrasRouter);
app.use("/subcontratos", subcontratosRouter);

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
