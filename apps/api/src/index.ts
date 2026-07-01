import express from "express";
import { prisma } from "./prisma";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/health", async (_req, res) => {
  const roles = await prisma.rol.findMany();
  res.json({ status: "ok", roles });
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
