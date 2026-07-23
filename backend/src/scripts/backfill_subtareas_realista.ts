import { prisma } from "../prisma";

// Backfill puntual: completa datos para que los proyectos de ejemplo se vean
// realistas en los gráficos/Gantt nuevos (Fase 4/5). Hace 3 cosas, todas
// idempotentes (se puede re-ejecutar sin duplicar ni pisar datos ya buenos):
//   1. Rellena Obra.fechaEntrega cuando está vacía, según faseGlobal.
//   2. Crea subtareas canónicas en los tracks nuevos (Enlaces, Empalmes, Hitos
//      UOCT, Sintonía Fina, Traspasos y Mantención) que hoy tienen 0 subtareas,
//      asignándoles un estado plausible según cuán avanzado va el proyecto.
//   3. Rellena fechaInicio/fechaVencimiento de TODAS las subtareas que aún no
//      las tengan (existentes + recién creadas) — pero agrupando por ESTADO
//      primero (HECHO → pasado, POR_HACER → futuro, EN_PROGRESO/EN_REVISION/
//      BLOQUEADO → alrededor de hoy) y solo dentro de cada grupo ordenando por
//      etapa del track + orden. Así ninguna tarea "Hecha" queda con fecha
//      futura ni ninguna "Por hacer" con fecha pasada, sin tocar el estado que
//      ya traía cada subtarea (la narrativa de avance sembrada se preserva).
// Al final recalcula el estadoActual de cada track tocado (misma lógica que
// derivarEstadoTrack en obras.ts, duplicada aquí porque es un script standalone).

const DIA_MS = 24 * 60 * 60 * 1000;

// Duración por defecto (desde fechaInicio) cuando la obra no tiene fechaEntrega,
// elegida para que "hoy" caiga en un punto de la fase acorde a faseGlobal.
const DURACION_POR_FASE: Record<string, number> = {
  CERRADO: 5 * 7 * DIA_MS, // proyecto ya cerrado: entrega quedó en el pasado
  GESTION: 11 * 7 * DIA_MS, // a media cancha: hoy cae ~mitad del plazo
  EJECUCION: 14 * 7 * DIA_MS,
  INICIO: 18 * 7 * DIA_MS, // recién comienza: la mayoría del plazo está por delante
};

// Orden típico de ejecución de un proyecto (0 = primero). COMUNICACIONES es un
// tipo de track legacy equivalente a INSTALACION/terreno en proyectos antiguos.
const ETAPA: Record<string, number> = {
  PERMISOS: 0,
  ADQUISICIONES: 1,
  ENLACES: 2,
  EMPALMES: 3,
  PROGRAMACION: 4,
  INSTALACION: 5,
  COMUNICACIONES: 5,
  HITOS_UOCT: 6,
  SINTONIA_FINA: 7,
  TRASPASOS_MANTENCION: 8,
};
const NUM_ETAPAS = 9;

const SUBTAREAS_CANONICAS: Record<string, string[]> = {
  ENLACES: ["Solicitar enlace con cruce vecino", "Coordinar con Servicio Técnico", "Enlace validado"],
  EMPALMES: ["Identificar puntos de empalme", "Ejecutar empalme físico", "Prueba de continuidad"],
  HITOS_UOCT: ["Notificar a UOCT", "Visita de inspección UOCT", "Hito UOCT aprobado"],
  SINTONIA_FINA: ["Medición de tiempos en terreno", "Ajuste de ciclos", "Validación final de sintonía"],
  TRASPASOS_MANTENCION: ["Preparar carpeta de traspaso", "Reunión de traspaso con Servicio Técnico", "Traspaso firmado"],
};

function derivarEstadoTrack(subtareas: { estado: string }[]): string {
  if (subtareas.length === 0) return "NO_INICIADO";
  if (subtareas.some((s) => s.estado === "BLOQUEADO")) return "BLOQUEADO";
  if (subtareas.every((s) => s.estado === "HECHO")) return "COMPLETADO";
  if (subtareas.some((s) => s.estado === "EN_PROGRESO" || s.estado === "EN_REVISION")) return "EN_CURSO";
  return "NO_INICIADO";
}

// Estado plausible para una subtarea NUEVA, según qué tan avanzado va el
// proyecto típicamente a esta altura (progresoTypico) vs. la posición de esta
// subtarea en la secuencia global de etapas (posGlobal).
// progresoTypico === 1 significa que la fecha de entrega ya pasó (o coincide
// con hoy): ahí no hay ambigüedad posible, todo debe quedar HECHO — evita que
// el margen de transición capture las últimas etapas como "aún en curso" en un
// proyecto que ya debería estar 100% cerrado.
function estadoPorAvanceTypico(etapa: number, orden: number, totalEnTrack: number, progresoTypico: number): "HECHO" | "EN_PROGRESO" | "POR_HACER" {
  if (progresoTypico >= 1) return "HECHO";
  const posGlobal = (etapa + (orden + 1) / totalEnTrack) / NUM_ETAPAS;
  const margen = 1 / (NUM_ETAPAS * 2);
  if (posGlobal <= progresoTypico - margen) return "HECHO";
  if (posGlobal <= progresoTypico + margen) return "EN_PROGRESO";
  return "POR_HACER";
}

// Reparte fechaVencimiento uniformemente dentro de [rangoInicio, rangoFin] según
// el orden de la lista (ya viene ordenada por etapa+orden); fechaInicio queda
// `duracionDias` antes (sin pasarse del inicio del rango).
function distribuirFechas<T extends { id: number }>(items: T[], rangoInicio: number, rangoFin: number, duracionDias = 2) {
  const n = items.length;
  return items.map((item, i) => {
    const frac = (i + 1) / n;
    const venc = rangoInicio + frac * (rangoFin - rangoInicio);
    const inicio = Math.max(rangoInicio, venc - duracionDias * DIA_MS);
    return { id: item.id, fechaInicio: new Date(inicio), fechaVencimiento: new Date(venc) };
  });
}

async function main() {
  const hoyMs = Date.now();
  const obras = await prisma.obra.findMany({
    include: { tracks: { include: { subtareas: true } } },
  });

  let obrasConEntregaSeteada = 0;
  let subtareasCreadas = 0;
  let subtareasConFechaRellenada = 0;
  let tracksRecalculados = 0;

  for (const obra of obras) {
    const inicioMs = obra.fechaInicio ? obra.fechaInicio.getTime() : hoyMs;

    let finMs = obra.fechaEntrega?.getTime();
    if (!finMs) {
      const duracion = DURACION_POR_FASE[obra.faseGlobal] ?? DURACION_POR_FASE.GESTION;
      finMs = inicioMs + duracion;
      await prisma.obra.update({ where: { id: obra.id }, data: { fechaEntrega: new Date(finMs) } });
      obrasConEntregaSeteada++;
    }
    const progresoTypico = Math.min(1, Math.max(0, (hoyMs - inicioMs) / (finMs - inicioMs)));

    // 1) Crear subtareas canónicas en tracks vacíos, con estado plausible según avance.
    for (const track of obra.tracks) {
      const titulos = SUBTAREAS_CANONICAS[track.tipo];
      if (track.subtareas.length === 0 && titulos) {
        const etapa = ETAPA[track.tipo] ?? 4;
        const data = titulos.map((titulo, i) => ({
          trackId: track.id,
          titulo,
          orden: i,
          prioridad: "MEDIA" as const,
          estado: estadoPorAvanceTypico(etapa, i, titulos.length, progresoTypico),
        }));
        await prisma.obraSubtarea.createMany({ data });
        subtareasCreadas += data.length;
        console.log(`Obra ${obra.codigoObra} / ${track.tipo}: +${data.length} subtarea(s) nuevas`);
      }
    }

    // 2) Rellenar fechas de TODAS las subtareas de la obra que aún no las tengan,
    //    agrupando por estado (no por track) para que la cronología sea coherente.
    const subtareasSinFecha = await prisma.obraSubtarea.findMany({
      where: { track: { obraId: obra.id }, OR: [{ fechaInicio: null }, { fechaVencimiento: null }] },
      include: { track: { select: { tipo: true } } },
    });

    const conEtapa = subtareasSinFecha
      .map((s) => ({ ...s, etapa: ETAPA[s.track.tipo] ?? 4 }))
      .sort((a, b) => a.etapa - b.etapa || a.orden - b.orden);

    const hechas = conEtapa.filter((s) => s.estado === "HECHO");
    const activas = conEtapa.filter((s) => s.estado === "EN_PROGRESO" || s.estado === "EN_REVISION" || s.estado === "BLOQUEADO");
    const porHacer = conEtapa.filter((s) => s.estado === "POR_HACER");

    const actualizacionesHechas = distribuirFechas(hechas, inicioMs, hoyMs);
    const actualizacionesActivas = distribuirFechas(activas, Math.max(inicioMs, hoyMs - 3 * DIA_MS), Math.min(finMs, hoyMs + 12 * DIA_MS));
    const actualizacionesPorHacer = distribuirFechas(porHacer, hoyMs, finMs);

    // Las tareas HECHO también fijan `updatedAt` a una fecha histórica coherente
    // (aprox. su fechaVencimiento) — si no, Prisma pone `updatedAt` = ahora en
    // cada UPDATE (por el @updatedAt del schema), y la Curva S "real" (que usa
    // updatedAt como proxy de fecha de término) mostraría todo completado hoy.
    for (const u of actualizacionesHechas) {
      await prisma.obraSubtarea.update({
        where: { id: u.id },
        data: { fechaInicio: u.fechaInicio, fechaVencimiento: u.fechaVencimiento, updatedAt: u.fechaVencimiento },
      });
    }
    for (const u of [...actualizacionesActivas, ...actualizacionesPorHacer]) {
      await prisma.obraSubtarea.update({ where: { id: u.id }, data: { fechaInicio: u.fechaInicio, fechaVencimiento: u.fechaVencimiento } });
    }
    subtareasConFechaRellenada += actualizacionesHechas.length + actualizacionesActivas.length + actualizacionesPorHacer.length;

    // 3) Recalcular estadoActual de cada track de la obra con su lista final de subtareas.
    for (const track of obra.tracks) {
      const subtareasFinal = await prisma.obraSubtarea.findMany({ where: { trackId: track.id }, select: { estado: true } });
      const nuevoEstado = derivarEstadoTrack(subtareasFinal);
      if (nuevoEstado !== track.estadoActual) {
        await prisma.obraTrack.update({ where: { id: track.id }, data: { estadoActual: nuevoEstado, ultimaActualizacion: new Date() } });
        tracksRecalculados++;
      }
    }
  }

  console.log(`\nListo.`);
  console.log(`  Obras con fechaEntrega completada: ${obrasConEntregaSeteada}`);
  console.log(`  Subtareas nuevas creadas: ${subtareasCreadas}`);
  console.log(`  Subtareas con fecha rellenada: ${subtareasConFechaRellenada}`);
  console.log(`  Tracks recalculados: ${tracksRecalculados}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
