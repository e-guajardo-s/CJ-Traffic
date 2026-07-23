import { prisma } from "../prisma";

// Nutre el kanban del proyecto "CJ Traffic Intranet" (proyectoId 6, el proyecto
// de Desarrollo donde se construye esta misma intranet) con lo entregado hasta
// hoy y los pendientes conocidos. Idempotente: por título busca si la tarea ya
// existe en el proyecto y la actualiza en vez de duplicarla, así se puede
// re-ejecutar sin riesgo tras ajustar este archivo.
const PROYECTO_ID = 6;

const ELIAS = 1; // desarrollo — autor de lo implementado hoy
const JAVIER = 4; // gerencia — validador pendiente

type TareaSeed = {
  titulo: string;
  descripcion: string;
  estado: "POR_HACER" | "EN_PROGRESO" | "EN_REVISION" | "HECHO" | "BLOQUEADO";
  asignadoId: number | null;
  fechaCambioEstado: string; // ISO date
  fechaLimite?: string; // ISO date
};

const TAREAS: TareaSeed[] = [
  // ── HECHO: base ya entregada y validada en commits previos ──
  {
    titulo: "Arquitectura full-stack base",
    descripcion: "Monorepo React+Vite+Tailwind / Express+Prisma / Postgres en Docker. SPA → apiFetch (JWT) → requireAuth/requireModulo → Prisma.",
    estado: "HECHO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-01",
  },
  {
    titulo: "Autenticación y RBAC por módulo",
    descripcion: "Login JWT, requireAuth + requireModulo, matriz de permisos por rol (gerencia/jefatura/desarrollo/coordinador/firmware).",
    estado: "HECHO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-02",
  },
  {
    titulo: "Módulo IoT (Inventario/Directorio/Gateways/Glosario)",
    descripcion: "Inventario de equipos, directorio de cruces, campos de gateway, glosario técnico.",
    estado: "HECHO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-02",
  },
  {
    titulo: "Módulo Proyectos (Desarrollo) base",
    descripcion: "Kanban de tareas, documentación, tecnologías I+D, pizarra por proyecto y general.",
    estado: "HECHO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-03",
  },
  {
    titulo: "Módulo Proyectos-Empresa: modelo de datos",
    descripcion: "Obra → Track → Subtarea + dominio financiero (Subcontrato/EP/Partidas) con redacción de costos por rol.",
    estado: "HECHO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-08",
  },

  // ── EN_REVISION: hecho hoy, pendiente de validación de gerencia ──
  {
    titulo: "Reestructura del detalle de proyecto en pestañas",
    descripcion: "Vista General / Tareas / Control de Costos / Carta Gantt. Presupuesto ahora editable (antes hardcodeado).",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Columna BLOQUEADO + fecha estimada de desbloqueo",
    descripcion: "Nueva columna en el kanban de líneas de trabajo, con captura de fecha de desbloqueo y motivo al bloquear.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Estado operativo del track automático",
    descripcion: "El estado del track se deriva automáticamente según en qué columnas están sus subtareas.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Alertas de bloqueo",
    descripcion: "Banner que avisa subtareas bloqueadas y permite saltar al track correspondiente.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Colores + barras de progreso por línea de trabajo",
    descripcion: "Color por responsable y estado, barra de avance por track, clasificación de estados por buckets de avance y filtro.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Gráficos en Vista General (recharts)",
    descripcion: "Avance por track, línea de tiempo de fases y Curva S (planificado vs real).",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Carta Gantt con SVAR",
    descripcion: "Gantt real con dependencia SVAR, botones expandir/colapsar todo, leyenda de colores y mejoras visuales.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Edición avanzada de subtareas",
    descripcion: "Editar título, fechas (inicio/vencimiento), prioridad y responsable de subtareas creadas.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Rediseño estético del kanban de líneas de trabajo",
    descripcion: "Columnas con color, tarjetas elevadas con sombra/hover, feedback visual de arrastre.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "I+D Tecnologías: edición",
    descripcion: "Editar nombre, categoría y descripción de una tecnología (endpoint PATCH + modal).",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Troubleshooting: fechas de descripción y acción",
    descripcion: "Campos de fecha para \"descripción de la falla\" y \"acción tomada\", en form y tarjeta.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Kanban Desarrollo: colores + BLOQUEADO en rojo",
    descripcion: "Columnas por color (por hacer/en progreso/revisión/hecho) y columna Bloqueado en rojo.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Kanban Desarrollo: fecha de fase editable + descripción completa",
    descripcion: "Fecha de cambio de fase (auto al mover, editable en el modal) y descripción sin truncar.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Hub de Proyectos: fecha de último avance",
    descripcion: "Muestra la fecha del último avance junto al badge de estado en cada tarjeta del hub.",
    estado: "EN_REVISION",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },

  // ── EN_PROGRESO: activo ──
  {
    titulo: "Actualizar handoff técnico y CLAUDE.md",
    descripcion: "Documentar módulos y campos nuevos (BLOQUEADO, fechas, Gantt SVAR) en docs/handoff.md.",
    estado: "EN_PROGRESO",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },

  // ── POR_HACER: pendiente ──
  {
    titulo: "Validación de gerencia de features en revisión",
    descripcion: "Revisar y aprobar/rechazar las tareas en En Revisión. Al aprobar, mover a Hecho.",
    estado: "POR_HACER",
    asignadoId: JAVIER,
    fechaCambioEstado: "2026-07-22",
    fechaLimite: "2026-07-29",
  },
  {
    titulo: "Fix: ImportarEpModal ignora subcontratoId",
    descripcion: "El modal siempre llama a POST /subcontratos/importar solo con obraId; el backend matchea por empresa+numeroOc y duplica contratos. Ver docs/handoff.md.",
    estado: "POR_HACER",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
    fechaLimite: "2026-07-31",
  },
  {
    titulo: "Extraer helper compartido de redacción de costos",
    descripcion: "puedeVerCostos/redactarX están duplicados en obras.ts y subcontratos.ts.",
    estado: "POR_HACER",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Paridad BLOQUEADO en kanban de Desarrollo",
    descripcion: "La columna Bloqueado en Desarrollo aún no captura fecha estimada de desbloqueo como en Proyectos-Empresa.",
    estado: "POR_HACER",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Suite de tests automatizados",
    descripcion: "Hoy no hay tests (npm test es placeholder). Montar Vitest en backend para rutas críticas (RBAC, redacción de costos, avance ponderado).",
    estado: "POR_HACER",
    asignadoId: ELIAS,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Notificaciones de tareas bloqueadas/vencidas",
    descripcion: "Avisar a responsables cuando una subtarea se bloquea o vence.",
    estado: "POR_HACER",
    asignadoId: null,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Exportar Carta Gantt / reportes a PDF",
    descripcion: "Generar PDF de la Carta Gantt y de avances por proyecto.",
    estado: "POR_HACER",
    asignadoId: null,
    fechaCambioEstado: "2026-07-22",
  },
  {
    titulo: "Migrar módulos restantes del legacy",
    descripcion: "Continuar migrando desde legacy/index.html los módulos aún no portados.",
    estado: "POR_HACER",
    asignadoId: null,
    fechaCambioEstado: "2026-07-22",
  },
];

async function main() {
  const proyecto = await prisma.proyecto.findUnique({ where: { id: PROYECTO_ID } });
  if (!proyecto) throw new Error(`Proyecto ${PROYECTO_ID} no encontrado.`);
  console.log(`Nutriendo kanban de "${proyecto.nombre}" (id ${PROYECTO_ID})...\n`);

  // orden secuencial por columna, continuando desde lo que ya exista en cada una
  const ordenPorEstado: Record<string, number> = {};
  for (const t of TAREAS) {
    if (ordenPorEstado[t.estado] === undefined) {
      const max = await prisma.proyectoTarea.aggregate({
        where: { proyectoId: PROYECTO_ID, estado: t.estado },
        _max: { orden: true },
      });
      ordenPorEstado[t.estado] = (max._max.orden ?? -1) + 1;
    }
  }

  let creadas = 0;
  let actualizadas = 0;

  for (const t of TAREAS) {
    const existente = await prisma.proyectoTarea.findFirst({
      where: { proyectoId: PROYECTO_ID, titulo: t.titulo },
    });

    const data = {
      descripcion: t.descripcion,
      estado: t.estado,
      asignadoId: t.asignadoId,
      fechaCambioEstado: new Date(t.fechaCambioEstado),
      fechaLimite: t.fechaLimite ? new Date(t.fechaLimite) : null,
    };

    if (existente) {
      await prisma.proyectoTarea.update({ where: { id: existente.id }, data });
      actualizadas++;
      console.log(`~ actualizada: [${t.estado}] ${t.titulo}`);
    } else {
      await prisma.proyectoTarea.create({
        data: {
          ...data,
          proyectoId: PROYECTO_ID,
          titulo: t.titulo,
          orden: ordenPorEstado[t.estado]++,
        },
      });
      creadas++;
      console.log(`+ creada: [${t.estado}] ${t.titulo}`);
    }

    // Para tareas HECHO, fija updatedAt a la fecha histórica (Prisma permite
    // sobreescribir @updatedAt) para que "último avance" en el hub no muestre "hoy".
    if (t.estado === "HECHO") {
      const tarea = await prisma.proyectoTarea.findFirst({ where: { proyectoId: PROYECTO_ID, titulo: t.titulo } });
      if (tarea) {
        await prisma.proyectoTarea.update({
          where: { id: tarea.id },
          data: { updatedAt: new Date(t.fechaCambioEstado) },
        });
      }
    }
  }

  const resumen = await prisma.proyectoTarea.groupBy({
    by: ["estado"],
    where: { proyectoId: PROYECTO_ID },
    _count: true,
  });

  console.log(`\n${creadas} creada(s), ${actualizadas} actualizada(s).\n`);
  console.table(resumen.map((r) => ({ estado: r.estado, cantidad: r._count })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
