import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";

export const firmwareRouter = Router();

firmwareRouter.get("/programaciones", requireAuth, requireModulo("firmware", "LECTURA"), async (_req, res) => {
  const programaciones = await prisma.programacion.findMany({
    include: { cruce: true, subidoPor: true, feedbacks: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(programaciones);
});
