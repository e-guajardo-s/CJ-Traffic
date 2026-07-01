# Plan de Implementación — Intranet CJ Traffic

> Basado en el **Informe Técnico de Stack, Arquitectura e Integración de APIs** (Jornada del 26-06-2026) y en el estado actual del prototipo `index.html`.
> Última actualización: 2026-07-01.

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
   /apps/web             → React + Vite + Tailwind
   /apps/api             → Node + Express
   /packages/db          → esquema, migraciones, seeds
   /infra                → IaC AWS (Terraform o CDK)
   /.github/workflows    → CI/CD
   ```
3. Definir 3 ambientes: `local` → `dev` (RDS pruebas + Defontana `replapi`) → `prod`.
4. `.env` + gestor de secretos desde el día 1 (nunca credenciales en el repo).

**Decisión pendiente:** ORM. Recomendado **Prisma** (esquema declarativo = migraciones + tipos + documentación del modelo en un solo lugar). Alternativas: Knex, Sequelize.

---

## Fase 1 — Modelo de datos + Auth/RBAC (1–1.5 semanas)

Base sobre la que todo se apoya (Próximos Pasos 1 y 4 del informe).

1. **Esquema PostgreSQL** (§6), agrupado por dominios:
   - *Identidad:* `usuarios`, `roles`, `permisos`, `rol_modulo_permiso` (matriz configurable por datos, no por código).
   - *Obras:* `proyectos`, `kanban_tareas`, `finanzas`.
   - *Bodega:* `solicitudes` (estado normal/crítica, monto, umbral), `aprobaciones`, `cola_despacho`, `materiales` (espejo cacheado de Defontana).
   - *Docs:* `documentos`/`programaciones` (metadata + link S3 + changelog), `feedback`.
   - *Terreno:* `cruces`. *Auditoría:* `bitacora` (inmutable).
2. **Migración de datos del prototipo:** script que transforma `OBRAS_REAL`, `FIN_MENSUAL`, `inventario` y `PERM` de `index.html` en seeds SQL. `PERM` → filas de `rol_modulo_permiso`.
3. **Auth (§8, §10):** JWT, hashing argon2/bcrypt, login. 2FA se puede diferir a Fase 6, pero dejar el campo/flag modelado para perfiles con aprobación.
4. **Middleware RBAC autoritativo (§7, §9):** valida en *cada* request el nivel de acceso (Oculto / Solo Lectura / Lectura+Escritura) por módulo. Ninguna regla de acceso vive en el frontend.
5. **Regla de excepción económica:** solicitud de bodega sobre umbral → escala a *Crítica* → bloqueada para despacho hasta aprobación de Gerencia/Jefatura. Lógica de servidor, no de UI.

**Hito:** API responde login + `GET /me/permissions` y un endpoint protegido de prueba con RBAC real.

---

## Fase 2 — Migración del frontend a React (2–3 semanas)

El prototipo ya definió UX, módulos y componentes; esto es *portar*, no rediseñar.

1. Scaffold Vite + React + Tailwind (config, no CDN). Portar el tema dark.
2. Descomponer `index.html` en componentes por módulo: Inicio, Obras (Resumen·Cartera/Kanban·Gantt·Financiero·Garantías), Bodega (Inventario·Solicitudes·Cola), Taller, Firmware, IoT, Agenda.
3. Reemplazar el **simulador de rol** por login real; la UI consume `perm(mod)` desde el backend (`GET /me/permissions`).
4. Cliente API (axios/fetch + interceptor JWT). Chart.js: mantener o migrar a Recharts en el módulo Financiero.
5. Cablear módulo por módulo a la API real, empezando por **Obras**.

---

## Fase 3 — Módulos de negocio contra API real (2–3 semanas)

Priorización según dolores del levantamiento:
1. **Obras** — Kanban (escritura Carlos/coordinación), Gantt editable, Financiero (solo Gerencia). Costos de material/mano de obra por proyecto derivados de despachos de bodega (lo pidió Carlos).
2. **Bodega** — inventario nativo, solicitudes con escalamiento crítico, cola de despacho, kárdex de movimientos. Descuento de stock al despachar pasa a transacción de BD.
3. **Cubicación** — dolor #1 de Javier; módulo base existe, priorizar tras Obras/Bodega.
4. Diferibles: Taller (Pablo), Firmware con control de versiones (Febe), IoT.

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

- [ ] Confirmar ORM (recomendado: Prisma).
- [ ] IaC: Terraform vs. AWS CDK.
- [ ] Librería de gráficos en React: mantener Chart.js o migrar a Recharts.
- [ ] Estrategia 2FA (TOTP/app authenticator vs. SMS/email).
