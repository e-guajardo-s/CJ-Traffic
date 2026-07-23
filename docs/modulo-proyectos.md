# Módulo Proyectos (motor operativo de Obras)

Documentación del módulo **Proyectos** de la intranet de CJ Traffic. Es el motor
operativo de la compañía: cada proyecto (semáforo nuevo, modificación de cruce,
CCTV, mantención) se gestiona aquí, y sobre él trabajan las áreas de obras,
mantención, desarrollo, bodega y servicio técnico.

> Basado en el wireframe `legacy/wireframes-proyectos-empresa.html`.

---

## 1. Roles y permisos

El módulo es **accesible a todo usuario autenticado** (en `AuthContext.puede`,
`proyectos_empresa` siempre retorna `true`). Las reglas finas se aplican de forma
**autoritativa en el backend**, nunca solo en el frontend:

| Capacidad | Quién |
|---|---|
| Ver listado, panel, detalle, tracks y kanban | Todos los roles |
| Ver **costos** (presupuesto, costo incurrido, precios de materiales) | Solo **gerencia** y **jefatura** |
| **Asignar responsables** (subgerente/coordinador), cambiar fase | Solo **gerencia** y **jefatura** |
| **Eliminar** proyecto | Solo **gerencia** y **jefatura** |
| Gestionar tracks, subtareas, notas, adjuntos, hitos, materiales | Cualquier usuario autenticado |

- El gateo de costos vive en `backend/src/routes/obras.ts` (`puedeVerCostos`,
  `redactarCostos`): al rol sin permiso se le **eliminan** los campos de dinero
  de la respuesta (no se ocultan solo en la UI).
- Las acciones de administración usan `puedeAdministrar` (mismos roles).

### Rol `coordinador`

Se agregó el rol **coordinador** (coordinadores de proyecto de Obras) en el seed.
Está en `OCULTO` para iot/firmware/admin, así que al ingresar solo ven el módulo
**Proyectos**. Usuarios sembrados: Javiera Orozco, Nelson Opazo, Juan Acuña,
Carlos Salas (correos `inicial.apellido@cjtraffic.cl`, password `cjtraffic123`).

---

## 2. Navegación y vistas

Submódulos en el sidebar (`frontend/src/types.ts` → `SUBMODULOS.proyectos_empresa`):

- **Panel Ejecutivo** (`/proyectos_empresa/panel`) — landing por defecto.
- **Listado** (`/proyectos_empresa/tablero`).

Rutas con parámetros (en `App.tsx`, todas dentro del `AppShell` con header + sidebar):

- `/proyectos_empresa/detalle/:proyectoId` — detalle del proyecto.
- `/proyectos_empresa/detalle/:proyectoId/track/:trackId` — vista de una línea de
  trabajo (kanban de subtareas).

### 2.1 Panel Ejecutivo (`PanelSubgerente.tsx`)

Vista ejecutiva del subgerente (pantalla 1 del wireframe). Consume
`GET /proyectos-empresa/dashboard`:

- **KPIs**: proyectos activos · bloqueados · hitos (7 días) · costo incurrido
  (esta última tarjeta solo para gerencia/jefatura).
- **Alertas operativas**: proyectos en riesgo/bloqueados, clicables al detalle.
- **Salud de proyectos por fase**: tabla con fase, barra de avance, costo (gateado)
  y chip de **riesgo** (OK / Permiso atrasado / Programación bloqueada). Incluye un
  texto explicativo de qué significa la "Salud del proyecto".
- **Hitos recientes**: bitácora de toda la organización, con autor, proyecto y
  tiempo relativo.

El **riesgo** se deriva del estado de los tracks (`evaluarRiesgo` en el backend):
programación `BLOQUEADO` ⇒ bloqueado; permiso `ESPERANDO_*` ⇒ riesgo.

### 2.2 Listado (`index.tsx`)

Listado general de proyectos y su avance (pantalla 2 del wireframe):

- **Filtros**: buscador (nombre/código/cliente) + selects de Tipo, Fase y
  Coordinador, con botón "Limpiar" y contador `N de M`.
- Columnas: Proyecto, Cliente, Coordinador, Fase, Tracks, Avance (barra).
- Botón **Eliminar** por fila (solo gerencia/jefatura).
- Botón **Nuevo Proyecto** (modal): crea la obra e inicializa sus tracks.

### 2.3 Detalle del proyecto (`ProyectoEmpresaDetalle.tsx`)

Pantalla 3 del wireframe:

- **Encabezado**: nombre, fase, cliente/tipo, jefe, coordinador, avance y costos
  (costos solo gerencia/jefatura).
- **Acciones**: *Asignar responsables* (modal, solo gerencia/jefatura),
  *Registrar hito* (modal), *Eliminar* (gerencia/jefatura).
- **Pipeline de fases**: Inicio → Gestión → Ejecución → Cerrado, con la actual
  resaltada.
- **Líneas de trabajo (tracks)**: tarjetas con icono SVG (sin emojis), estado,
  responsable y progreso de subtareas. Al hacer clic **navegan** a la vista del
  track.
- **Bitácora histórica**: muro de hitos con autor y fecha (clave para traspasos
  entre coordinadores).
- **Costos del proyecto**: incurrido vs presupuesto (solo gerencia/jefatura).

### 2.4 Vista de línea de trabajo / kanban (`TrackVista` en `ProyectoEmpresaDetalle.tsx`)

Es **una ruta propia dentro del layout normal** (header + sidebar), no un overlay:

- Encabezado con "Volver al proyecto", icono, nombre del proyecto y contador de
  subtareas.
- Toolbar para editar **estado del track** y **responsable**.
- **Kanban de subtareas** en 4 columnas (Por hacer / En progreso / En revisión /
  Hecho): agregar, mover (`‹ ›`) y eliminar subtareas. Las tarjetas muestran
  indicadores de adjuntos y de nota.
- En el track de **Materiales (Adquisiciones)** aparece una columna extra con el
  **inventario asociado**: solicitudes a Bodega, sus ítems (con marca de inventario
  y precio solo para gerencia/jefatura) y un formulario para pedir nuevo material.
- Al hacer clic en una subtarea se abre un **panel lateral** con:
  - **Notas y observaciones** (texto libre, con guardado).
  - **Documentación adjunta**: subir archivos (se guardan en `/uploads`), abrir en
    nueva pestaña y eliminar.

---

## 3. Modelo de datos (`backend/prisma/schema.prisma`)

- **Obra** — proyecto. Campos clave: `codigoObra`, `nombre`, `cliente`, `tipoObra`,
  `faseGlobal` (enum `FaseObra`), `presupuesto`, `costoAcumulado`, `subgerenteId`,
  `coordinadorId`. Relaciones: `tracks`, `bitacora`, `solicitudes`,
  `programaciones`, `equipamiento`.
- **ObraTrack** — línea de trabajo asíncrona. `tipo` (enum `TipoTrack`:
  PERMISOS, ADQUISICIONES, PROGRAMACION, INSTALACION, COMUNICACIONES),
  `estadoActual` (texto libre), `responsableId`, `subtareas`.
- **ObraSubtarea** — tarjeta del kanban del track. `titulo`, `estado` (enum
  `EstadoTarea`: POR_HACER, EN_PROGRESO, EN_REVISION, HECHO), `orden`, **`notas`**,
  `archivos`.
- **ObraSubtareaArchivo** — documento adjunto a una subtarea (`nombre`, `url`,
  `extension`).
- **ObraBitacora** — hitos/eventos del proyecto (`tipoEvento`, `mensaje`, autor).
- **SolicitudMaterial / ItemSolicitud** — solicitudes a Bodega (inventario
  asociado). `costoTotal` y `precioUnitario` son visibles solo para
  gerencia/jefatura.

Migraciones relevantes de este trabajo:
`20260708131450_obra_subtareas`, `20260708133731_subtarea_notas_archivos`.

---

## 4. API (`backend/src/routes/obras.ts`, montado en `/proyectos-empresa`)

| Método y ruta | Descripción | Gate |
|---|---|---|
| `GET /` | Listado con `avance`; costos redactados si no corresponde | auth |
| `GET /dashboard` | KPIs, salud, hitos y alertas del Panel | auth (costos gateados) |
| `GET /usuarios` | Lista de usuarios (id, nombre, rol) para asignar | auth |
| `GET /:id` | Detalle con tracks, subtareas, archivos, bitácora, solicitudes | auth |
| `POST /` | Crear proyecto e inicializar tracks | auth |
| `PATCH /:id` | Asignar responsables / fase / presupuesto | **gerencia/jefatura** |
| `DELETE /:id` | Eliminar proyecto (cascada) | **gerencia/jefatura** |
| `POST /:id/bitacora` | Registrar hito | auth |
| `POST /:id/materiales` | Crear solicitud de materiales | auth |
| `PATCH /tracks/:trackId` | Estado / responsable del track | auth |
| `POST /tracks/:trackId/subtareas` | Crear subtarea | auth |
| `PATCH /subtareas/:id` | Mover / renombrar / reordenar / editar `notas` | auth |
| `DELETE /subtareas/:id` | Eliminar subtarea | auth |
| `POST /subtareas/:id/archivos` | Adjuntar documento (base64) | auth |
| `DELETE /subtareas/archivos/:id` | Eliminar adjunto | auth |

> Nota de orden de rutas: las rutas literales (`/usuarios`, `/dashboard`) y de dos
> segmentos (`/tracks/:id`, `/subtareas/:id`) se declaran antes de `/:id`.

---

## 5. Datos de ejemplo (`backend/prisma/seed.ts`)

`npm run seed` (idempotente) crea 4 proyectos con tracks, bitácora y subtareas cuyo
estado se deriva de la fase de cada proyecto:

| Código | Proyecto | Fase | Riesgo | Coordinador |
|---|---|---|---|---|
| OBR-2026-045 | Semáforo Av. Kennedy / Manquehue | Gestión | 🔴 Programación bloqueada | Carlos Salas |
| OBR-2026-039 | Modificación Cruce Vespucio / Grecia | Ejecución | 🟢 OK | Javiera Orozco |
| OBR-2026-047 | Semáforo Peatonal Colegio San José | Gestión | 🟢 OK | Nelson Opazo |
| OBR-2026-051 | CCTV Ruta 68 Sector Túnel | Inicio | 🟢 OK | Juan Acuña |

---

## 6. Pendientes / no integrado

Módulos del wireframe que son **áreas aparte** y aún no se implementan como tal:
vista móvil de técnico en terreno (pantalla 6), y Bodega / Servicio Técnico como
módulos completos (pantallas 4 y 5). El detalle ya se conecta con ellos vía el
track de Materiales.

### ⚠ Trabajo en paralelo con conflicto (revisar)

Existen archivos **sin trackear** que parecen de otra sesión/rama y que **rompen el
`tsc`/build** y divergen del diseño actual:

- `frontend/src/pages/proyectos-empresa/AlertasModule.tsx`
- `frontend/src/pages/proyectos-empresa/ControlCostosModule.tsx`
- `frontend/src/pages/proyectos-empresa/MaterialesModule.tsx`
- `frontend/src/pages/proyectos-empresa/SubcontratosModule.tsx`
- `backend/src/routes/subcontratos.ts`

Problemas detectados:

1. Usan un campo **`observaciones`** (array) en la subtarea y un endpoint
   `/proyectos-empresa/subtareas/:id/observaciones` que **no existen** en el
   backend (aquí se implementó **`notas`** como texto + adjuntos). Hay que decidir
   un solo diseño (`notas` string vs `observaciones` array).
2. No están enganchados al ruteo (`App.tsx`) ni al servidor (`index.ts`).
3. `AlertasModule.tsx` tiene errores de tipo (referencia `sub.observaciones` sin
   declararlo). `index.tsx` dejó `TRACK_COLORS` sin uso tras un cambio de columna.

> El `dev` de Vite corre igual (transpila sin type-check), pero `tsc`/build fallan.
> Recomendación: reconciliar `observaciones` vs `notas` antes de integrar estos
> módulos.
