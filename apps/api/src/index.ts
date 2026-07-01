import express from "express";
import { prisma } from "./prisma";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/health", async (_req, res) => {
  const roles = await prisma.rol.findMany();
  res.json({ status: "ok", roles });
});

app.get("/iot/gateways", async (_req, res) => {
  const cruces = await prisma.cruce.findMany({
    include: { gateway: true },
    orderBy: { codigo: "asc" },
  });
  res.json(cruces);
});

app.get("/firmware/programaciones", async (_req, res) => {
  const programaciones = await prisma.programacion.findMany({
    include: { cruce: true, subidoPor: true, feedbacks: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(programaciones);
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
