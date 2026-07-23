# Handoff Técnico — Intranet CJ Traffic

> Generado el 2026-07-08 para continuar el proyecto en una sesión nueva. Refleja el estado real del código en ese momento (no solo lo planeado).

---

## Estado actual del proyecto

Monorepo full-stack (`frontend` + `backend` + Postgres) reemplazando un prototipo original de un solo archivo (`legacy/index.html`, aún referenciado para datos reales de seed). El desarrollo avanza **módulo por módulo**: Área de Desarrollo (IoT/Firmware) está completo de punta a punta; el foco activo actual es **Proyectos** (antes "Obras y Proyectos"), el motor operativo de la compañía.

**Hay trabajo concurrente de otra persona/sesión (Carlos) sobre los mismos archivos.** Varias veces en esta sesión aparecieron cambios no hechos por mí (campos nuevos en el schema, endpoints, módulos completos como `AlertasModule.tsx`) — **antes de asumir que un archivo está en el estado que describo abajo, vuelve a leerlo.**

El repo **no tiene commits de este trabajo todavía** — todo lo describido abajo está en el working tree sin commitear (ver `git status`). Es intencional (el usuario no ha pedido commits).

Comandos para levantar todo localmente:
```
docker compose up -d          # Postgres en :5432 (user/pass/db: cjtraffic/cjtraffic_dev/cjtraffic)
cd backend && npm run dev     # API en :3001
cd frontend && npm run dev    # Vite en :5173, proxy /api y /uploads → :3001
```
Seed: `cd backend && npm run seed` (idempotente — no duplica si ya corrió). Usuarios de prueba con password `cjtraffic123`.

---

## Funcionalidades implementadas

### Área de Desarrollo (IoT/Firmware) — completo
- Directorio de cruces + gateways (`Cruce`, `GatewayIot`, mantenciones).
- Inventario de equipos con unidades individuales (`ItemInventario`, `UnidadInventario`), descuento/ingreso de stock.
- Firmware: control de versiones de programaciones + feedback aprobación/rechazo.
- Proyectos de I+D (kanban + páginas de documentación estilo Notion + pizarra vectorial + stack tecnológico + troubleshooting).
- Glosario técnico, panel de administración de usuarios.

### Módulo Proyectos (motor operativo) — en desarrollo activo
- **Panel Ejecutivo** (`PanelSubgerente.tsx`): KPIs, alertas operativas (riesgo/bloqueo derivado del estado de los tracks), tabla de salud de proyectos, hitos recientes.
- **Listado** (`index.tsx`): filtros (texto, tipo, fase, coordinador), columnas con avance por track, eliminar proyecto.
- **Detalle de proyecto** (`ProyectoEmpresaDetalle.tsx`, 1083 líneas): pipeline de fases, tarjetas de "líneas de trabajo" (tracks), bitácora histórica, pestaña "Control de Costos" (gated a gerencia/jefatura).
- **Vista de track / kanban** (`TrackVista`, ruta propia con header+sidebar, no overlay): kanban de subtareas (4 columnas), panel lateral por subtarea con **notas** (texto libre) + **observaciones** (hilo de comentarios con autor/fecha) + **documentos adjuntos**. Soporta deep-link desde Alertas (`location.state.openSubtareaId` auto-abre la subtarea).
- **Gestión de Alertas** (`AlertasModule.tsx`, solo gerencia/jefatura): proyectos bloqueados + tareas vencidas/por vencer, permite dejar observaciones directas en tareas.
- **Subcontratos y Estados de Pago** (`SubcontratosModule.tsx`, ~850 líneas): CRUD de subcontratos, EP manuales o **importados desde Excel** (parser fiel al formato de Javiera Orozco — carátula + detalle por partidas), modal "Ver detalle" con secciones colapsables agrupadas por capítulo, edición de avance planificado, eliminar contrato/EP.
- **Materiales** (`MaterialesModule.tsx`): historial de solicitudes de materiales por obra (se crean desde el kanban del track de Adquisiciones).
- **Control de Costos** (`ControlCostosModule.tsx`): wrapper con sub-pestañas Subcontratos/Materiales.

### RBAC y seguridad
- JWT + rol único por usuario. Matriz `RolModuloPermiso` (OCULTO/LECTURA/ESCRITURA) para iot/firmware/admin.
- `proyectos_empresa` es accesible a **todo usuario autenticado** (no usa la matriz de módulos); las restricciones finas (costos, administración) se resuelven **en el backend**, nunca solo en frontend.
- **Costos redactados a `null`** (nunca `delete` de la key, para no romper `Number(x)` sin guarda en el frontend) para roles que no son `gerencia`/`jefatura`, en: `obras.ts` (presupuesto, costoAcumulado, materiales) y `subcontratos.ts` (montoContrato, todos los campos de EstadoPago, partidas, archivoUrl del Excel).

---

## Funcionalidades pendientes

1. **Bug conocido sin resolver**: al importar un Excel de EP desde el botón dentro de un contrato ya expandido, el backend matchea por `empresa + numeroOc`, no por el `subcontratoId` que el usuario ya tiene abierto — si el Excel no calza exactamente, **crea un subcontrato duplicado** en vez de agregarlo al existente. El modal de importación (`ImportarEpModal`) ignora el `subcontratoId` que se le pasa. **Reportado por el usuario, no corregido aún.**
2. **Importar subcontrato directo desde Excel** (sin EP) — el usuario pidió revisar si esto es necesario/posible; no se implementó, solo existe importación de EP (que crea el subcontrato implícitamente si no existe).
3. Boletas de Garantía, Curva S, Carta Gantt — están en el `legacy/dashboard_carlos.html` de referencia pero no implementadas (el usuario decidió explícitamente acotar el alcance a "Subcontratos + EP" por ahora).
4. Vista móvil de técnico en terreno (pantalla 6 del wireframe) — no implementada.
5. Módulos Bodega y Servicio Técnico como áreas completas (con su propia cola de trabajo) — no implementados; el detalle de proyecto se conecta con ellos solo vía el track de Materiales.
6. `usuarioLite` en `subcontratos.ts` está declarado pero sin usar (dead code trivial, no bloquea nada).
7. Existen dos scripts de debug sueltos en `backend/src/scripts/` (`analyze_excel.py`, `debug_ep.js`) — utilidades de diagnóstico del parser de Excel, no parte del código de producción; se pueden borrar cuando ya no se necesiten.
8. Hay archivos `.xls` de prueba commiteados en `backend/uploads/` (subidos durante pruebas manuales) y en `legacy/archivos_prueba/` — revisar si deben quedar en el repo.

---

## Arquitectura

```
Browser (React SPA, Vite dev server :5173)
   │  fetch('/api/...')  — proxy Vite → backend
   ▼
Express API (:3001)
   │  Prisma Client
   ▼
PostgreSQL (Docker, :5432)
```

- **Sin SSR.** SPA pura con `react-router-dom` (rutas cliente).
- **Autenticación**: JWT firmado en login (`POST /auth/login`), guardado en `localStorage`, enviado como `Authorization: Bearer` en cada request vía `apiFetch` (`frontend/src/api.ts`).
- **Autorización**: middleware `requireAuth` (valida JWT) + `requireModulo(clave, nivel)` (valida rol↔módulo) en `backend/src/auth.ts`. Para `proyectos_empresa`, la autorización fina se hace a mano dentro de cada handler (funciones `puedeVerCostos`/`puedeAdministrar` repetidas en `obras.ts` y `subcontratos.ts` — **no están unificadas en un solo helper compartido**, quedó duplicado).
- **Archivos**: subida como base64 en el body JSON (límite 15mb en `express.json()`), se decodifican y escriben a `backend/uploads/`, servidos estáticos vía `express.static`. No hay S3 ni CDN — es local/filesystem.
- **Sin tests automatizados.** `npm test` en backend es un placeholder. Verificación durante el desarrollo = `tsc --noEmit` (frontend) + scripts ad-hoc con `tsx` contra la BD real (creaban y limpiaban datos de prueba).

---

## Estructura de carpetas

```
/frontend
  src/
    pages/
      proyectos-empresa/     ← módulo activo (ver arriba)
      iot/, firmware/, admin/, proyectos/  ← Área de Desarrollo
    components/               ← ver sección "Componentes reutilizables"
    App.tsx                   ← todas las rutas (react-router)
    AuthContext.tsx           ← estado de sesión + permisos + helper puede()
    api.ts                    ← apiFetch (fetch wrapper con JWT)
    types.ts                  ← Modulo, SubVista, tablas de labels/submenús
/backend
  src/
    routes/                   ← un router Express por dominio
    lib/parseEstadoPago.ts    ← parser de Excel (ver "Decisiones importantes")
    scripts/                  ← utilidades de debug del parser (no producción)
    auth.ts, bitacora.ts, prisma.ts, index.ts
  prisma/
    schema.prisma
    migrations/
    seed.ts                   ← datos de ejemplo idempotentes
/docs                         ← documentación de este handoff + modulo-proyectos.md
/legacy                       ← index.html original + dashboard_carlos.html (referencia de diseño) + archivos_prueba (Excel reales)
```

---

## Componentes reutilizables

Frontend (`frontend/src/components/`):
- **`Modal.tsx`** — modal centrado genérico (`title`, `onClose`, `children`). Usado en casi todos los formularios. Nota: los modales "grandes" con contenido largo (ej. `DetalleEpModal`) **no usan este componente** — implementan su propio `fixed inset-0` a mano porque necesitan scroll interno + header sticky.
- **`CargandoTabla.tsx`** — skeleton de carga genérico.
- **`StatCard.tsx`** — tarjeta KPI con color (`neutral|emerald|red|amber|violet|orange`).
- **`toast.ts` + `ToastContainer.tsx`** — `showToast(mensaje, "success"|"error")`.
- **`Header.tsx` / `Sidebar.tsx`** — shell de la app (usados dentro de `AppShell` en `App.tsx`).

Backend: no hay componentes compartidos formales, pero sí **patrones repetidos** que actúan como tal (ver "Patrones utilizados").

---

## Decisiones importantes

1. **RBAC autoritativo en backend, nunca en frontend** — principio declarado explícitamente en comentarios del `schema.prisma` y aplicado de forma consistente: toda redacción de costos ocurre en el handler Express, el frontend solo refleja lo que llega (con fallbacks seguros como `?? 0` o `"—"`).
2. **`notas` vs `observaciones` en subtareas — NO es un bug, son dos conceptos distintos que coexisten**: `notas` es un campo de texto libre editable (una sola nota por subtarea); `observaciones` (modelo `ObraSubtareaNota`) es un hilo de comentarios con autor+fecha, pensado para que gerencia deje directivas en tareas bloqueadas (usado por `AlertasModule`). Si en el futuro parece redundante, no consolidar sin entender este propósito distinto.
3. **`fechaVencimiento` es obligatoria al crear una subtarea** (lo impuso la sesión concurrente) — cualquier UI que cree subtareas debe pedir fecha, si no el backend responde 400.
4. **Redacción de costos con `null`, no con `delete`** — decisión explícita para no romper `Number(x)` sin guarda en componentes ya escritos (`Number(null) === 0`, `Number(undefined) === NaN`). Ver funciones `redactarCostos*` en `obras.ts` y `subcontratos.ts`.
5. **El % "avance real" del subcontrato es financiero, no un promedio simple de partidas.** Es el `% Ejecutado a la fecha` de la carátula del Excel = `montoEjecutadoAcumulado / montoContrato` (ponderado por presupuesto). Un promedio simple de los % de cada partida da un número muy distinto y engañoso (se verificó con datos reales: 18% simple vs 91% ponderado — ambos "correctos" matemáticamente pero miden cosas distintas). **No calcular nunca un promedio simple de `avanceAcumuladoPct` de partidas como "avance del subcontrato".**
6. **Avance Real ya no se ingresa manualmente al crear un subcontrato** (decisión reciente) — solo se deriva de la carátula del EP importado. Avance Plan sigue siendo manual porque el Excel no lo trae.
7. **Migraciones reconciliadas sin pérdida de datos**: hubo un caso donde la sesión concurrente aplicó cambios de schema vía `prisma db push` (sin migración versionada) directo a la BD de desarrollo. Se reconcilió generando el SQL de diferencia contra una BD sombra temporal y marcándolo como ya aplicado con `prisma migrate resolve --applied`, sin tocar la BD real. Si vuelve a pasar drift entre `schema.prisma` y `prisma/migrations/`, usar el mismo método (no `migrate reset`).
8. **Sin pruebas E2E por defecto** (preferencia explícita del usuario, ahorro de tokens) — verificar con `tsc --noEmit`, lectura de código, y scripts `tsx` puntuales contra la BD real quelimpian sus propios datos de prueba. No levantar el stack completo ni usar el preview del navegador salvo que el usuario lo pida.
9. **Solo commitear cuando el usuario lo pida explícitamente** — no se ha hecho ningún commit del trabajo de esta sesión.

---

## Convenciones de código

- **Español para nombres de dominio** (modelos, variables, mensajes de error, comentarios); **inglés para keywords/sintaxis del lenguaje**. Ej: `puedeVerCostos`, `obraId`, `"No tienes permisos"`.
- **Comentarios solo cuando el "por qué" no es obvio** — no describir qué hace el código, sí explicar decisiones no evidentes (ej. por qué se usa `null` y no `delete` para redactar).
- **Cada router valida y redacta él mismo** — no hay middleware genérico de redacción de campos; cada endpoint que devuelve datos sensibles llama explícitamente a su función `redactarX`.
- **Modales como funciones separadas al final del archivo** (no en archivos propios) cuando son específicos de una sola página — ej. todos los modales de `SubcontratosModule.tsx` viven en ese mismo archivo.
- **IDs de rutas de dos segmentos antes de `/:id`** — en Express, rutas como `/tracks/:trackId` o `/ep/:epId` se declaran ANTES de la ruta comodín `/:id` para que no sea capturada por el patrón genérico primero.
- **Prisma con adapter `pg` explícito** (`@prisma/adapter-pg`), no el driver por defecto — ver `backend/src/prisma.ts`.
- **`any` liberal en el frontend para datos de API** — los componentes de `proyectos-empresa` en general no tipan estrictamente las respuestas del backend (usan `any[]`, `sub: any`, etc.), a diferencia de `ProyectoEmpresaDetalle.tsx` que sí define interfaces completas. Inconsistente entre archivos, no corregido.

---

## Librerías utilizadas

**Backend**:
- `express` 5.x — servidor HTTP.
- `@prisma/client` + `@prisma/adapter-pg` 7.x — ORM (con adapter pg explícito, no el driver nativo default).
- `pg` — driver Postgres.
- `bcryptjs` — hash de passwords.
- `jsonwebtoken` — JWT.
- `xlsx` (SheetJS) 0.18.5 — parser de Excel (`.xls`/`.xlsx`). **⚠ Tiene una vulnerabilidad conocida sin fix en el registro npm** (ReDoS + prototype pollution, `GHSA-4r6h-8v6p-xvw6` y `GHSA-5pgg-2g8v-p4x9`). Riesgo aceptado porque solo personal interno autenticado sube estos archivos. Si se necesita endurecer, SheetJS publica versiones parchadas en su propio CDN en vez del registro npm.
- `dotenv`, `tsx` (runtime dev sin compilar), `typescript` (solo para el editor — **no hay `tsconfig.json` en backend**, no se puede correr `tsc --noEmit` ahí; la verificación de tipos del backend se hace leyendo el código y con boot-tests puntuales).

**Frontend**:
- `react` 19 + `react-dom` 19.
- `react-router-dom` 7.
- `vite` 8 + `@vitejs/plugin-react`.
- `tailwindcss` 4 (vía `@tailwindcss/vite`, sin `tailwind.config.js` — configuración CSS-first) + `@tailwindcss/typography`.
- `@tiptap/react` + `@tiptap/starter-kit` — editor rich-text (usado en documentación de proyectos I+D).
- `@react-pdf/renderer` + `react-to-print` — generación de PDFs (reportes de proyectos I+D).
- `exceljs` — **existe como dependencia del frontend pero no se usa en el módulo Proyectos** (el parseo de Excel de EP es 100% backend con `xlsx`). Puede ser de otro módulo (exportación de inventario IoT — ver `frontend/src/pages/iot/inventarioExcel.ts` y `excelExport.ts`).
- `oxlint` — linter (no ESLint tradicional).

---

## Variables de entorno

`backend/.env` (no versionado, existe localmente):
```
DATABASE_URL=postgresql://cjtraffic:cjtraffic_dev@localhost:5432/cjtraffic?schema=public
JWT_SECRET=<hex largo>
```

Además, `backend/prisma.config.ts` referencia `SHADOW_DATABASE_URL` (opcional, no seteada en `.env` actualmente) — se usó una vez de forma temporal para reconciliar una migración con una BD sombra manual, luego se dejó configurada por si se necesita `prisma migrate dev` con drift en el futuro. Es inocua si no está seteada.

`frontend`: sin `.env` — todo hardcodeado vía el proxy de `vite.config.ts` (`/api` y `/uploads` → `http://localhost:3001`).

---

## Endpoints existentes

Montados en `backend/src/index.ts`: `/iot`, `/iot/inventario`, `/firmware`, `/admin`, `/proyectos` (Área de Desarrollo), `/proyectos-empresa` (**obrasRouter** — el módulo Proyectos), `/subcontratos`. Más `/health`, `/auth/login`, `/me/permissions` sueltos en `index.ts`.

### `/proyectos-empresa` (obras.ts) — router del módulo Proyectos
| Método | Ruta | Notas |
|---|---|---|
| GET | `/` | Listado, avance calculado, costos redactados |
| GET | `/dashboard` | Panel Ejecutivo: KPIs, salud, alertas, hitos |
| GET | `/alertas/tareas` | Solo gerencia/jefatura — tareas bloqueadas/vencidas |
| GET | `/usuarios` | Lista liviana para asignar responsables |
| PATCH | `/tracks/:trackId` | Estado/responsable del track |
| POST | `/tracks/:trackId/subtareas` | `fechaVencimiento` **obligatoria** |
| PATCH | `/subtareas/:id` | Estado, notas, tipo, fecha |
| POST | `/subtareas/:id/archivos` | Adjuntar doc (base64) |
| DELETE | `/subtareas/archivos/:id` | |
| POST | `/subtareas/:id/observaciones` | Hilo de comentarios |
| DELETE | `/observaciones/:id` | Solo autor o gerencia/jefatura |
| DELETE | `/subtareas/:id` | |
| GET | `/:id` | Detalle completo del proyecto |
| PATCH | `/:id` | Responsables/fase — gerencia/jefatura o el coordinador asignado (con restricciones) |
| DELETE | `/:id` | Solo gerencia/jefatura, cascada |
| POST | `/:id/bitacora` | Hito manual |
| POST | `/:id/materiales` | Crear solicitud |
| GET | `/:id/materiales` | Costos redactados |
| POST | `/` | Crear proyecto + inicializa tracks |

### `/subcontratos` (subcontratos.ts)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/?obraId=` | Costos redactados; incluye `partidas` con `avances` |
| POST | `/` | Crear subcontrato (sin `avanceReal` manual) |
| PATCH | `/:id` | Editar `observaciones` (el "plan" ya no existe: el avance real se sigue por EP) |
| PATCH | `/partidas/:id` | Editar precio/cantidad/descripción de un ítem — gerencia/jefatura o coordinador asignado a la obra; audita en `ObraBitacora` |
| POST | `/:id/partidas` | Agregar un ítem de presupuesto nuevo — mismo gate, mismo audit |
| GET | `/:id/exportar-excel` | Genera un `.xlsx` con el presupuesto vigente (incluye ediciones) |
| POST | `/importar` | **Sube Excel de EP** → crea/reusa subcontrato + partidas, crea EP + avances por partida. ⚠ Bug conocido de matching (ver pendientes) |
| POST | `/:id/ep` | EP manual simple (sin carátula detallada) |
| PATCH | `/ep/:epId` | Cambiar estado (ajusta `costoAcumulado` de la obra si pasa a/desde PAGADO) |
| DELETE | `/ep/:epId` | Revierte costo si estaba PAGADO, borra archivo adjunto |
| DELETE | `/:id` | Cascada, revierte costos de EPs PAGADO, borra archivos |

---

## Modelos de datos

Ver `backend/prisma/schema.prisma` completo (691 líneas) para el detalle exacto. Resumen por dominio:

- **Identidad/RBAC**: `Rol`, `Usuario`, `Modulo`, `RolModuloPermiso` (enum `NivelAcceso`).
- **Área de Desarrollo**: `Cruce`, `GatewayIot`, `MantencionGateway`, `Programacion`, `Feedback`, `CategoriaInventario`, `ItemInventario`, `UnidadInventario`, `Proyecto` (kanban I+D), `Pizarra`, `ProyectoPagina`, `ProyectoTarea`, `BitacoraEntry` (auditoría), `Tecnologia`, `ArchivoTecnico`, `ComponenteStack`, `TerminoGlosario`, `IncidenciaTroubleshooting`.
- **Proyectos Empresa (simple, legacy dentro del mismo dominio)**: `ProyectoEmpresa`, `TareaEmpresa`, `NotaEmpresa` — **no confundir con el módulo Proyectos activo**, que usa el modelo `Obra` (nombrado así por razones históricas, pero es el concepto "Proyecto" de cara al usuario).
- **Núcleo Obras/Proyectos**:
  - `Obra` (enum `FaseObra`: INICIO/GESTION/EJECUCION/CERRADO) — el proyecto.
  - `ObraTrack` (enum `TipoTrack`: PERMISOS/ADQUISICIONES/PROGRAMACION/INSTALACION/COMUNICACIONES) — línea de trabajo.
  - `ObraSubtarea` (enum `EstadoTarea`, compartido con `ProyectoTarea`) — tarjeta del kanban del track. Tiene `notas` (texto) + relaciones `archivos` (`ObraSubtareaArchivo`) y `observaciones` (`ObraSubtareaNota`, con autor).
  - `ObraBitacora` — hitos/eventos del proyecto.
  - `SolicitudMaterial` + `ItemSolicitud` (enum `EstadoSol`) — pedidos a Bodega.
  - `ProgramacionObra`, `EquipamientoTerreno` — no tienen UI de escritura propia aún más allá de lo básico.
  - **`Subcontrato`** — especialidad, empresa, `montoContrato` (Total Obra neto), `numeroOc`, `montoAnticipo`, `devAnticipoPct`, `retencionPct`, `ivaPct`, `avanceReal` (espejo del % acumulado del último EP; ya no existe `avancePlan` — el "plan" de un contrato es siempre 100%, el avance real se ve por Estado de Pago).
  - **`PartidaPresupuesto`** — línea de presupuesto (o fila-capítulo con `esCapitulo=true`), pertenece a un `Subcontrato`.
  - **`EstadoPago`** — carátula completa del EP: `montoEp` (compat), `subtotal`, `devAnticipo`, `retencion`, `montoNeto`, `iva`, `totalPagar`, `avanceAcumuladoPct`, `archivoUrl`.
  - **`AvancePartidaEP`** — avance (%, $) de cada partida en un EP específico: Acumulado/Anterior/Actual. `@@unique([estadoPagoId, partidaId])`.

---

## Patrones utilizados

1. **Redacción condicional de costos**: cada router con datos financieros define `puedeVerCostos(rolNombre)` y una función `redactarX(objeto)` que reemplaza campos monetarios por `null` cuando el rol no es gerencia/jefatura. Se aplica en la respuesta, nunca se evita la query — se filtra al final.
2. **Bitácora automática**: casi toda mutación relevante en `obras.ts` crea también una entrada en `ObraBitacora` (ej. cambio de fase, reasignación de coordinador, cambio de estado de track) para trazabilidad — patrón manual, no un hook/trigger genérico.
3. **Upload de archivos vía base64 en JSON**: no hay `multipart/form-data`/`multer`. El frontend lee el `File` con `FileReader.readAsDataURL`, corta el prefijo `data:...;base64,`, y lo manda como string en el body JSON. El backend hace `Buffer.from(base64, "base64")` y escribe a `UPLOADS_DIR` con nombre único `${Date.now()}-${random}.${ext}`.
4. **Importador tolerante a desplazamiento de filas, no de columnas**: `parseEstadoPagoXls` busca celdas por **etiqueta** (regex sobre el texto, ej. `/EMPRESA/`) en vez de posición fija de fila, porque las filas del Excel varían; pero una vez encontrada la etiqueta, lee **offsets de columna fijos** relativos a esa fila (ej. "Dev. Anticipo" en col 1, pct en col 2, monto en col 3) porque esos sí son estables entre los dos archivos reales analizados. Ver función `grillaDesdeColumnaA` para el bug de columnas que corrigió (la hoja "Detalle EP" arranca en columna B, no A — hay que forzar el rango o todos los índices quedan corridos).
5. **Modal con header sticky para contenido largo**: cuando un modal tiene scroll interno largo (ej. `DetalleEpModal`), el header (título + botón cerrar) se separa en su propio `div` con `sticky top-0 z-10 bg-white` **dentro** del contenedor `overflow-y-auto`, en vez de estar fuera del scroll.
6. **Secciones colapsables reutilizables ad-hoc**: componente local `Seccion` (dentro de `SubcontratosModule.tsx`, no exportado/compartido) para agrupar contenido con collapse — si se necesita en otro archivo, **duplicar el patrón o extraerlo a `components/`**, hoy no está compartido.
7. **Deep-linking a UI anidada vía `location.state`**: `AlertasModule` navega a `/proyectos_empresa/detalle/:id/track/:trackId` pasando `state={{ openSubtareaId }}`; `TrackVista` lo lee con `useLocation()` para auto-abrir el panel lateral de esa subtarea específica.
8. **Migraciones "resueltas" sin re-ejecutar SQL**: cuando la BD ya tiene un cambio aplicado (vía `db push` accidental) pero falta el archivo de migración, se genera con `prisma migrate diff --from-migrations ... --to-schema ...` contra una BD sombra, se guarda el SQL en una carpeta de migración nueva, y se marca aplicada con `prisma migrate resolve --applied <nombre>` — **no se re-ejecuta el SQL contra la BD real**.

---

## Riesgos conocidos

1. **Bug de duplicación de subcontratos al importar Excel** (ver pendientes #1) — riesgo funcional activo, reportado por el usuario, sin corregir.
2. **Vulnerabilidad sin parche en `xlsx`** (ver Librerías) — riesgo de seguridad aceptado pero no mitigado técnicamente.
3. **Trabajo concurrente sin control de versiones** — no hay commits, dos personas (al menos) editan los mismos archivos directamente sobre el working tree. Alto riesgo de que un `git status`/diff de una sesión no refleje lo que otra sesión ya cambió. **Siempre releer el archivo antes de asumir su contenido.**
4. **Backend sin `tsconfig.json`** — no se puede correr `tsc --noEmit` para verificar tipos del backend; los errores de tipo solo se detectan al ejecutar (`tsx`) o leyendo el código a mano. Ya causó al menos un bug real no detectado hasta ejecución (ver Decisión #10 más abajo... en realidad no aplica, era el import).
5. **RBAC duplicado, no unificado**: `puedeVerCostos`/`puedeAdministrar` están redefinidos idénticos en `obras.ts` y `subcontratos.ts`. Si la regla de negocio cambia (ej. agregar rol `contabilidad` con acceso a costos), hay que actualizar en dos lugares y es fácil olvidar uno.
6. **`.xls` de prueba commiteados en `backend/uploads/`** — quedaron ahí de pruebas manuales de importación; no es data sintética generada por seed, son archivos reales subidos a mano.
7. **Sin backups/rollback de `costoAcumulado`** — los incrementos/decrementos de `costoAcumulado` al cambiar estados de EP son operaciones separadas (no transaccionales con la creación/eliminación del EP) — una falla a mitad de camino podría dejar el costo desincronizado del estado real de los EPs. No se ha visto en la práctica pero el código no usa `prisma.$transaction` para estas secuencias.

---

## TODO

En orden sugerido de prioridad (no es un compromiso, es lo que el usuario dejó pendiente o mencionado):

1. **Corregir el bug de importación duplicando subcontratos** — hacer que `ImportarEpModal` pase y respete el `subcontratoId` cuando se abre desde un contrato ya expandido, en vez de solo matchear por empresa+OC en el backend.
2. Revisar y decidir si se implementa **"importar subcontrato directo con Excel"** (sin depender de que el Excel sea un EP) — el usuario pidió explícitamente "revisar eso".
3. Definir si se unifica el RBAC de costos (`puedeVerCostos`/`puedeAdministrar`) en un helper compartido (ej. `backend/src/rbac.ts`) en vez de duplicarlo por router.
4. Decidir el destino de los archivos de debug (`backend/src/scripts/*`) y los `.xls` de prueba en `backend/uploads/` y `legacy/archivos_prueba/`.
5. Evaluar mitigar la vulnerabilidad de `xlsx` (usar el paquete parcheado del CDN de SheetJS) si el uso deja de ser solo interno.
6. Cuando el módulo Proyectos esté más maduro, considerar si conviene renombrar el modelo `Obra`→algo más alineado con "Proyecto" (haría una migración grande, evaluar costo/beneficio).

---

## Qué debe recordar el siguiente Claude

- **Este proyecto tiene edición concurrente activa por otra persona.** No asumas que el código que leíste hace unos mensajes sigue igual — vuelve a leer antes de editar, especialmente `schema.prisma`, `obras.ts`, `subcontratos.ts` y los archivos de `proyectos-empresa/`.
- **No levantes el stack completo, no uses el preview del navegador, ni corras pruebas E2E por defecto.** El usuario está en "tiempos de guerra" de presupuesto de tokens y prefiere verificar él mismo. Usa `tsc --noEmit` (solo frontend — el backend no tiene `tsconfig.json`), lectura de código, y si es imprescindible validar lógica de negocio contra la BD real, escribe un script `tsx` puntual que **limpie sus propios datos de prueba al final** (patrón ya usado varias veces en esta sesión).
- **No commitees nada a menos que se pida explícitamente.** No hay commits de todo este trabajo.
- **El "avance real" de un subcontrato es financiero (ponderado por presupuesto), nunca un promedio simple de porcentajes de partidas.** Si algo parece "mal calculado" en un % de avance, verifica primero si estás comparando un promedio simple contra uno ponderado antes de asumir que hay un bug.
- **`notas` y `observaciones` en subtareas son conceptos distintos e intencionales** — no los fusiones sin entender el caso de uso de cada uno (nota libre vs. hilo de comentarios de gerencia).
- **La redacción de costos usa `null`, nunca `delete`** — si agregas un campo monetario nuevo a un endpoint, síguelo mismo patrón (los componentes del frontend asumen que los campos existen pero pueden ser `null`, no `undefined`).
- **Hay un bug real y ya diagnosticado esperando fix**: la duplicación de subcontratos al importar Excel (ver TODO #1). Si el usuario retoma este tema, el diagnóstico ya está hecho — no hace falta re-investigar, solo implementar el fix (pasar `subcontratoId` al modal y priorizarlo sobre el matching por empresa+OC en el backend).
- **El parser de Excel (`parseEstadoPagoXls`) fue validado exhaustivamente contra los 2 archivos reales** (`EP_01.xls`, `EP_02.xls` en `legacy/archivos_prueba/`) — los números coinciden exactamente con inspección manual. Si se reporta un problema de parseo, sospecha primero de un caso de formato distinto al de estos dos archivos, no de un bug genérico del parser.
- **Lee `docs/modulo-proyectos.md`** para más detalle específico del módulo Proyectos (complementa este handoff, escrito en un punto anterior de la misma sesión — puede tener alguna sección desactualizada respecto a este documento, este handoff es el más reciente).
