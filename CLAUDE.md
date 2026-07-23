# CLAUDE.md

Guía para trabajar en este repo. Ver también [docs/handoff.md](docs/handoff.md) (handoff técnico completo) y [docs/modulo-proyectos.md](docs/modulo-proyectos.md) (detalle del módulo Proyectos) y [PLAN.md](PLAN.md) (plan de fases original).

## Qué es esto

Intranet operativa de CJ Traffic (semaforización/ITS, Chile). Monorepo: `frontend` (React+Vite+Tailwind) + `backend` (Express+Prisma) + Postgres. Reemplaza un prototipo de un solo archivo (`legacy/index.html`), migrando módulo por módulo. Módulo activo actual: **Proyectos** (`frontend/src/pages/proyectos-empresa/`, backend `obras.ts` + `subcontratos.ts`).

## Comandos

```bash
docker compose up -d              # Postgres (:5432, user/pass/db: cjtraffic/cjtraffic_dev/cjtraffic)
cd backend && npm run dev         # API :3001 (tsx watch, sin build)
cd frontend && npm run dev        # Vite :5173, proxy /api y /uploads → :3001
cd backend && npm run seed        # datos de ejemplo (idempotente)
cd frontend && npx tsc --noEmit -p tsconfig.app.json   # única forma de typecheck (backend NO tiene tsconfig.json)
```

No hay tests automatizados (`npm test` en backend es un placeholder).

## Reglas de esta sesión de trabajo

- **No levantar el stack completo, no usar preview del navegador, no correr E2E por defecto.** El usuario prefiere verificar él mismo (ahorro de tokens). Verificar con `tsc --noEmit`, lectura de código, o scripts `tsx` puntuales contra la BD real que limpien sus propios datos al terminar.
- **No hacer commits salvo que se pida explícitamente.** Este proyecto no tiene commits del trabajo reciente todavía.
- **Hay edición concurrente por otra persona sobre los mismos archivos.** Antes de editar `schema.prisma`, `obras.ts`, `subcontratos.ts` o cualquier archivo de `proyectos-empresa/`, vuelve a leerlo — puede haber cambiado desde la última vez que lo viste en esta conversación.

## Arquitectura en una línea

SPA React sin SSR → `apiFetch` (`frontend/src/api.ts`, JWT en `Authorization: Bearer`) → Express con `requireAuth` + `requireModulo` → Prisma (`@prisma/adapter-pg`) → Postgres. Archivos se suben como base64 en JSON (sin multer/S3), se escriben a `backend/uploads/`, servidos con `express.static`.

## Convenciones

- Español para dominio (modelos, variables, mensajes), inglés para sintaxis del lenguaje.
- Comentarios solo para el "por qué" no obvio, nunca para describir qué hace el código.
- Rutas Express de dos segmentos (`/tracks/:id`, `/ep/:epId`) se declaran **antes** de `/:id` genérico.
- Modales viven como funciones al final del mismo archivo de página cuando son específicos de esa página (no se extraen a `components/` salvo que sean genéricos: ver `Modal.tsx`, `CargandoTabla.tsx`, `StatCard.tsx`, `toast.ts`).
- **Redacción de costos por rol**: cada router financiero define `puedeVerCostos(rolNombre)` (`=== "gerencia" || === "jefatura"`) y una función `redactarX()` que reemplaza campos monetarios por **`null`** (nunca `delete`, porque el frontend hace `Number(x)` sin guarda y `Number(null) === 0` pero `Number(undefined) === NaN`). Aplica en `obras.ts` y `subcontratos.ts`, duplicado en ambos (no hay helper compartido todavía).
- RBAC autoritativo en el backend siempre — el frontend nunca es la única barrera.

## Datos que no debes recalcular mal

**El "avance real" de un subcontrato es financiero y ponderado por presupuesto** (`% Ejecutado a la fecha` de la carátula del Excel = monto ejecutado acumulado / monto total del contrato), **no** un promedio simple de los `avanceAcumuladoPct` de cada partida — esos dos números pueden diferir muchísimo (ej. 18% simple vs 91% ponderado, verificado con datos reales) y ambos son "correctos" para lo que miden. Si algo parece mal calculado, primero verifica cuál de los dos estás comparando.

`notas` y `observaciones` en `ObraSubtarea` son campos **distintos e intencionales**, no duplicados: `notas` = texto libre editable único; `observaciones` (modelo `ObraSubtareaNota`) = hilo de comentarios con autor/fecha (usado por `AlertasModule` para que gerencia deje directivas). No fusionar.

## Bug conocido pendiente

Al importar un Excel de Estado de Pago desde el botón dentro de un contrato ya expandido, `ImportarEpModal` **ignora** el `subcontratoId` que se le pasa y siempre llama a `POST /subcontratos/importar` solo con `obraId`. El backend matchea el subcontrato por `empresa + numeroOc`; si no calza exactamente, crea un contrato duplicado en vez de agregar el EP al existente. Diagnóstico ya hecho, fix pendiente — ver `docs/handoff.md` sección TODO.

## Modelo de datos clave (módulo Proyectos)

`Obra` (el "Proyecto", nombrado así por historia) → `ObraTrack` (línea de trabajo: PERMISOS/ADQUISICIONES/PROGRAMACION/INSTALACION/COMUNICACIONES) → `ObraSubtarea` (kanban) → `ObraSubtareaArchivo` + `ObraSubtareaNota`. Además `ObraBitacora` (hitos), `SolicitudMaterial`+`ItemSolicitud`, y el dominio financiero: `Subcontrato` → `PartidaPresupuesto` (presupuesto por línea) + `EstadoPago` (carátula del EP) → `AvancePartidaEP` (avance de cada partida por EP). Ver `backend/prisma/schema.prisma` para el detalle completo y `docs/handoff.md` para la tabla de endpoints.
