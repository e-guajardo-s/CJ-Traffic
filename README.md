# Intranet CJ Traffic

Ver [PLAN.md](./PLAN.md) para el plan de implementación completo (fases, arquitectura, decisiones abiertas).

## Estructura

```
/frontend      → React + Vite + Tailwind
/backend       → Node.js + Express + Prisma
/packages/db   → Esquema, migraciones y seeds de PostgreSQL (referencia; el esquema vive en backend/prisma)
/infra         → Infraestructura como código (AWS)
/legacy        → Prototipo original (index.html) — referencia funcional y fuente de datos reales para seeds
```

## Cómo correr localmente

1. `docker compose up -d` (Postgres, desde la raíz del repo)
2. `npm run dev` dentro de `backend` (API en `http://localhost:3001`)
3. `npm run dev` dentro de `frontend` (app en `http://localhost:5173`, con proxy `/api` hacia el backend)

Credenciales de desarrollo: ver `backend/prisma/seed.ts`.

## Estado

Módulo piloto **Área de Desarrollo** (IoT + Firmware) funcionando de punta a punta: Auth JWT, RBAC autoritativo, edición con auditoría, frontend React consumiendo la API real. Ver [PLAN.md](./PLAN.md) para el detalle de fases.
