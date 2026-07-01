import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("Falta JWT_SECRET en el entorno");

export interface JwtPayload {
  sub: number;
  rolId: number;
  rolNombre: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

// Capa de backend (autoritativa, §7 informe): valida el token en cada request.
// Ninguna regla de acceso se delega al frontend.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta token de autenticación" });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

const NIVEL_RANGO: Record<string, number> = { OCULTO: 0, LECTURA: 1, ESCRITURA: 2 };

// Middleware de RBAC por módulo: exige un nivel mínimo de acceso para el rol del usuario.
export function requireModulo(moduloClave: string, nivelMinimo: "LECTURA" | "ESCRITURA") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const permiso = await prisma.rolModuloPermiso.findFirst({
      where: { rolId: req.user.rolId, modulo: { clave: moduloClave } },
    });
    const nivel = permiso?.nivel ?? "OCULTO";

    if (NIVEL_RANGO[nivel] < NIVEL_RANGO[nivelMinimo]) {
      return res.status(403).json({ error: `Rol sin acceso ${nivelMinimo.toLowerCase()} al módulo ${moduloClave}` });
    }
    next();
  };
}
