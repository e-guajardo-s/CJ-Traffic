# Plan de Implementación — Intranet CJ Traffic

> Basado en el **Informe Técnico de Stack, Arquitectura e Integración de APIs** (Jornada del 26-06-2026) y en el estado actual del prototipo `index.html`.
> Última actualización: 2026-07-01.

## Decisiones tomadas

- **ORM: Prisma.** Capa que traduce entre código y tablas SQL (evita escribir SQL a mano), genera migraciones automáticas a partir de un esquema declarativo (`schema.prisma`) y sirve como documentación viva del modelo de datos — clave dado el volumen de relaciones (roles↔permisos↔módulos, proyectos↔bodega↔materiales).
- **Orden de arranque: primero el módulo/Área de Desarrollo Tecnológico.** Antes de abordar Obras/Bodega en profundidad, se deja sanjado el área propia de Desarrollo (rol `desarrollo`, Elías Guajardo) que hoy existe en el prototipo como: (1) **Mantenedor IoT** — directorio de telemetría Cruce↔Controlador↔Gateway (`view-iot`, tabla `iotTable`, alta de gateways); (2) **Firmware con control de versiones** — carga de programaciones, historial/changelog, feedback de aprobación/rechazo hacia Taller (`view-firmware`). Este módulo es más acotado que Obras/Bodega y sirve como primer caso real para validar el ciclo completo backend+RBAC+React de punta a punta antes de escalar a los módulos más grandes.

## Punto de partida vs. destino

| | Hoy (prototipo) | Destino (jornada 26-06) |
|---|---|---|
| Frontend | 1 `index.html`, Tailwind CDN | React + Vite + Tailwind (build), en S3 + CloudFront |
| Lógica/permisos | `const PERM` + `perm()` en cliente | Middleware RBAC autoritativo en Express |
| Datos | `OBRAS_REAL`, `FIN_MENSUAL`, `inventario` hardcodeados | PostgreSQL (RDS) con claves foráneas |
| Persistencia | Ninguna (memoria del navegador) | API REST + Postgres + S3 archivos |
| Integraciones | Simuladas | Defontana, Buk, CJ SMART Traffic |
| Deploy | Abrir archivo | CI/CD GitHub Actions + AWS CodeDeploy → EC2 |

**Activo clave a no perder:** el prototipo ya contiene datos reales validados (45 proyectos de cartera, serie financiera mensual, inventario, matriz `PERM`). No se descarta — se convierte en los *seeds* (datos iniciales) y en la especificación viva del modelo de datos.

## Stack definitivo (según informe)

- **Frontend:** React.js (compilado con Vite) + Tailwind CSS.
- **Backend:** Node.js + Express.js (API REST personalizada, núcleo de reglas de negocio y RBAC).
- **Base de datos:** PostgreSQL (relacional, por integridad referencial de la matriz de permisos).
- **Infra AWS:** S3 estático (frontend) + CloudFront (CDN/SSL), EC2 (API), RDS (Postgres administrado), S3 secundario (archivos vía URLs firmadas).
- **CI/CD:** GitHub Actions + AWS CodeDeploy sobre EC2.
- **Integraciones:** Defontana (stock), CJ SMART Traffic (telemetría), Buk (RRHH).

---

## Fase 0 — Fundaciones del repositorio (1–2 días)

1. `git init` en `D:\dev\intranet` + repo remoto en GitHub. Preservar `index.html` como `/legacy/prototype.html`.
2. Estructura monorepo:
   ```
   /frontend             → React + Vite + Tailwind
   /backend              → Node + Express + Prisma
   /packages/db          → esquema, migraciones, seeds (referencia)
   /infra                → IaC AWS (Terraform o CDK)
   /.github/workflows    → CI/CD
   ```
3. Definir 3 ambientes: `local` → `dev` (RDS pruebas + Defontana `replapi`) → `prod`.
4. `.env` + gestor de secretos desde el día 1 (nunca credenciales en el repo).

**ORM decidido: Prisma** (esquema declarativo = migraciones + tipos + documentación del modelo en un solo lugar).

---

## Fase 1 — Modelo de datos + Auth/RBAC (1–1.5 semanas)

Base sobre la que todo se apoya (Próximos Pasos 1 y 4 del informe).

**0. ✅ Entorno técnico local:** Postgres 16 vía Docker (`docker-compose.yml`) + Prisma 7 (`@prisma/adapter-pg`) + API Express mínima en `backend`. Ciclo `schema.prisma` → `prisma migrate dev` → datos visibles, validado end-to-end.

**0.1 ✅ Primer caso real — Área de Desarrollo Tecnológico:** modeladas y migradas las tablas del módulo piloto (rol `desarrollo`): `Cruce`, `GatewayIot` (Mantenedor IoT: Cruce↔Controlador↔Gateway), `Programacion` y `Feedback` (Firmware con estado en_cola/en_prueba/aprobado/rechazado). Identidad mínima (`Usuario`/`Rol`) para autoría. Seed (`backend/prisma/seed.ts`) carga los datos reales del prototipo (5 cruces/gateways, 3 firmwares con su feedback). Endpoints de prueba: `GET /iot/gateways`, `GET /firmware/programaciones`.

**0.2 ✅ Auth + RBAC sobre el piloto:** `Usuario.passwordHash` (bcryptjs), `POST /auth/login` (emite JWT con `rolId`), `GET /me/permissions` (matriz rol→módulo del usuario autenticado). Modelos `Modulo` y `RolModuloPermiso` (niveles OCULTO/LECTURA/ESCRITURA) reemplazan el `PERM` de cliente. Middleware `requireAuth` + `requireModulo(clave, nivelMinimo)` protege `/iot/gateways` y `/firmware/programaciones`. Validado end-to-end: login válido/inválido, 401 sin token, 403 con permiso insuficiente (rol `firmware`→`iot`=OCULTO), 200 con permiso suficiente.

**0.3 ✅ Profundización — edición + auditoría + diseño visual:**
- Backend: `PATCH /iot/gateways/:cruceId` (requiere `ESCRITURA` en `iot`) edita modelo/SIM-APN/estado con validación; rutas modularizadas en `src/routes/{iot,firmware}.ts`.
- Modelo `BitacoraEntry` (§8 informe): registro inmutable de acciones sensibles (autor, acción, entidad, valores antes/después en JSON). El PATCH de gateway ya escribe en bitácora.
- Frontend: layout completo estilo prototipo — `Sidebar` (logo, nav por módulo con ícono, estado activo `amber-500/10`, chip de usuario con color por rol), header con título dinámico, sistema de `Toast` (pub-sub simple) y `Modal` genérico. Modal de edición de gateway con formulario controlado, guardado async y refresco de tabla. Validado en navegador con Elías (`desarrollo`, ve ambos módulos, puede editar IoT) y confirmado en bitácora (2 entradas registradas: vía curl y vía UI).

**0.4 ✅ Rediseño a modo claro + routing real + Inicio compartido + panel de administración:**
- Frontend migrado completo a modo claro (paleta corporativa gris/naranjo/rojo del logo). Login rediseñado (dos paneles, foto + formulario).
- Routing real con `react-router-dom` (`/login`, `/`, `/:modulo`, `/:modulo/:submodulo`) reemplazando el estado en memoria — URL refleja módulo/submódulo activo, back/forward del navegador funciona.
- **Inicio (`/`):** pantalla compartida para todos los roles autenticados (no depende de RBAC por módulo). Accesos rápidos a BUK (`cj-traffic.buk.cl`) y CJ Smart Traffic (`cjsmart.cl`), enlaces externos reales. Queda espacio reservado para paneles de avisos/estado del software cuando existan las fuentes de datos.
- Módulo "Desarrollo" (antes "Infraestructura IoT") renombrado — es la etiqueta visible del módulo `iot`, sin tocar la clave interna ni el RBAC.
- **Panel de administración (`admin`):** nuevo módulo con `GET /admin/roles`, `GET /admin/usuarios`, `POST /admin/usuarios` (bcryptjs + bitácora `usuario.crear`). RBAC: solo `desarrollo`, `gerencia` y `jefatura` tienen `ESCRITURA`; el resto `OCULTO`. Frontend: listado de usuarios + modal de creación (nombre, email, rol, contraseña temporal ≥8 caracteres). Validado con `curl`: creación exitosa, 409 por email duplicado, 403 para rol sin permiso (`firmware`).

1. **Esquema PostgreSQL** (§6), agrupado por dominios:
   - *Identidad:* ✅ `Usuario`, `Rol`, `Modulo`, `RolModuloPermiso` (piloto). Falta extender a Obras/Bodega.
   - *Obras:* `proyectos`, `kanban_tareas`, `finanzas`.
   - *Bodega:* `solicitudes` (estado normal/crítica, monto, umbral), `aprobaciones`, `cola_despacho`, `materiales` (espejo cacheado de Defontana).
   - *Docs:* ✅ `Programacion`/`Feedback` (piloto, con changelog vía `estado` + historial de `Feedback`). Falta generalizar a `documentos` de otros módulos.
   - *Terreno:* ✅ `Cruce`. *Auditoría:* `bitacora` (inmutable) — pendiente.
2. **Migración de datos del prototipo:** ✅ hecho para el piloto (`seed.ts`); pendiente para `OBRAS_REAL`, `FIN_MENSUAL`, `inventario` de Obras/Bodega.
3. **Auth (§8, §10):** ✅ JWT + bcryptjs, login. 2FA se difiere a Fase 6 (campo no modelado aún — agregar al extender `Usuario`).
4. **Middleware RBAC autoritativo (§7, §9):** ✅ implementado y validado sobre el piloto (`requireModulo`); se reutiliza tal cual al modelar Obras/Bodega, solo agregando filas a `RolModuloPermiso`.
5. **Regla de excepción económica:** solicitud de bodega sobre umbral → escala a *Crítica* → bloqueada para despacho hasta aprobación de Gerencia/Jefatura. Lógica de servidor, no de UI. (Pendiente — depende del esquema de Bodega.)

**Hito parcial alcanzado:** API responde login + `GET /me/permissions` y endpoints protegidos con RBAC real, sobre el módulo piloto Área de Desarrollo.

---

## Fase 2 — Migración del frontend a React (2–3 semanas)

El prototipo ya definió UX, módulos y componentes; esto es *portar*, no rediseñar.

1. ✅ Scaffold Vite + React + Tailwind v4 (`@tailwindcss/vite`, sin CDN) en `frontend`. Tema dark portado (fondo `neutral-950`, tarjetas `neutral-900`).
2. Descomponer `index.html` en componentes por módulo: Inicio, Obras (Resumen·Cartera/Kanban·Gantt·Financiero·Garantías), Bodega (Inventario·Solicitudes·Cola), Taller, Firmware, IoT, Agenda. *(Hecho: IoT y Firmware — piloto. Pendiente el resto.)*
3. ✅ Reemplazado el simulador de rol por **login real** (`src/pages/Login.tsx` + `AuthContext`); la UI consume `GET /me/permissions` y oculta pestañas según el nivel de acceso del rol (validado con Elías=`desarrollo` viendo ambas pestañas vs. Febe=`firmware` sin ver IoT).
4. ✅ Cliente API (`src/api.ts`, fetch + token JWT en `Authorization`, proxy Vite `/api` → `localhost:3001`). Chart.js: pendiente decidir al llegar a Financiero.
5. ✅ Cableado a la API real: **Área de Desarrollo (IoT + Firmware)** funcionando end-to-end (login → RBAC → datos reales). Siguiente: **Obras**.

**Cómo correr localmente:** `docker compose up -d` (Postgres) → `npm run dev` en `backend` (puerto 3001) → `npm run dev` en `frontend` (puerto 5173, con proxy a la API).

---

## Fase 3 — Módulos de negocio contra API real (2–3 semanas)

Priorización: primero el módulo piloto propio, luego según dolores del levantamiento:
0. **Área de Desarrollo (IoT + Firmware)** — piloto de punta a punta (ver Fase 1, punto 0.1). Mantenedor IoT (alta/edición de gateways) y Firmware con control de versiones + feedback de aprobación/rechazo hacia Taller.
1. **Obras** — Kanban (escritura Carlos/coordinación), Gantt editable, Financiero (solo Gerencia). Costos de material/mano de obra por proyecto derivados de despachos de bodega (lo pidió Carlos).
2. **Bodega** — inventario nativo, solicitudes con escalamiento crítico, cola de despacho, kárdex de movimientos. Descuento de stock al despachar pasa a transacción de BD.
3. **Cubicación** — dolor #1 de Javier; módulo base existe, priorizar tras Obras/Bodega.
4. Diferible: **Taller** (Pablo).

---

## Fase 4 — Integraciones externas (2–3 semanas, parcialmente paralelizable)

1. **Defontana (§5, §9.1):** servicio centralizado de tokens (cada token nuevo invalida el anterior). Cron que consulta `Inventory` (GET) y persiste en `materiales`; alertas de stock crítico sobre datos cacheados. Validar en `replapi.defontana.com` antes de prod.
2. **CJ SMART Traffic (§9.2):** paneles de telemetría de cruces embebidos, auth alineada al realm corporativo.
3. **Buk (§9.3):** solo lectura, tokens modulares por mínimo privilegio. Endpoints: asistencia, nómina, turnos. Convertir UTC → `America/Santiago`, manejar paginación. Se deja estructurada (no bloqueante para MVP).

### Matriz de sincronización (referencia del informe)
| API | Endpoint | Método | Frecuencia | Destino en la intranet |
|---|---|---|---|---|
| Defontana | Inventory (stock) | GET | Cron | Tabla `materiales` — alertas de stock crítico |
| CJ SMART | Cruces / Telemetría | GET | Tiempo real | Paneles embebidos (terreno) |
| Buk | Asistencia por empresa | GET | Programada | Control de gestión |
| Buk | Nómina de colaboradores | GET | Programada | Directorio interno — fichas de usuario |
| Buk | Asignación de turnos | GET | Programada | Planificación de cuadrillas |

---

## Fase 5 — Infraestructura AWS + CI/CD (1–1.5 semanas)

Próximos Pasos 2 y 6. Idealmente el *skeleton* se adelanta durante Fase 1.

1. **RDS PostgreSQL** (respaldos/snapshots administrados).
2. **S3 estático** (build React) + **CloudFront** (CDN, SSL centralizado, sin acceso público directo al bucket).
3. **S3 multimedia** dedicado + flujo de **URLs firmadas temporales** desde Node (subida directa navegador→S3, en BD solo el enlace).
4. **EC2** para la API Node.
5. **CI/CD:** GitHub Actions (build + tests) + AWS CodeDeploy → EC2 en cada push a `main`.

---

## Fase 6 — Seguridad, auditoría y cierre (1 semana)

1. 2FA para perfiles con privilegio de aprobación (§8).
2. `bitacora` inmutable: aprobaciones, cambios de stock, accesos a docs restringidas.
3. Secrets manager para credenciales de terceros.
4. Hardening HTTPS/SSL en CloudFront; revisión de mínimo privilegio en tokens.

---

## Ruta crítica y secuenciamiento

```
Fase 0 ─► Fase 1 (modelo + RBAC) ─┬─► Fase 2 (React) ─► Fase 3 (módulos)
                                  └─► Fase 5 skeleton (RDS/S3) [en paralelo]
Fase 4 (integraciones) arranca cuando Fase 1 y Bodega (Fase 3) están listas
Fase 6 cierra
```

- **Camino más corto a un MVP demostrable:** Fase 1 + Obras de Fase 2/3 + RDS de Fase 5 = intranet real con login, RBAC y módulo Obras persistido.
- **Estimación total:** ~9–13 semanas para un desarrollador, según paralelización de infra e integraciones.

---

## Decisiones abiertas

- [ ] IaC: Terraform vs. AWS CDK.
- [ ] Librería de gráficos en React: mantener Chart.js o migrar a Recharts.
- [ ] Estrategia 2FA (TOTP/app authenticator vs. SMS/email).
