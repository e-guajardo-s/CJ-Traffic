# Intranet CJ Traffic

Ver [PLAN.md](./PLAN.md) para el plan de implementación completo (fases, arquitectura, decisiones abiertas).

## Estructura

```
/apps/web      → Frontend React + Vite + Tailwind
/apps/api      → Backend Node.js + Express
/packages/db   → Esquema, migraciones y seeds de PostgreSQL
/infra         → Infraestructura como código (AWS)
/legacy        → Prototipo original (index.html) — referencia funcional y fuente de datos reales para seeds
```

## Estado

Fase 0 en curso: fundaciones del repositorio.
