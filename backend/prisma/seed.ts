import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Contraseña de desarrollo para todos los usuarios de seed. Cambiar en producción.
const DEV_PASSWORD = "cjtraffic123";

// Matriz de acceso a los módulos del piloto (inferida de los atributos data-roles
// del prototipo: view-iot y view-firmware, y de qué roles pueden escribir/aprobar).
// El rol "coordinador" (coordinadores de proyecto de Obras) no accede a los
// módulos del piloto (iot/firmware/admin) → OCULTO. Su trabajo vive en el módulo
// Proyectos, que es accesible a todo usuario autenticado (no usa esta matriz).
const PERMISOS_MODULO: Record<string, Record<string, "OCULTO" | "LECTURA" | "ESCRITURA">> = {
  iot: { desarrollo: "ESCRITURA", gerencia: "LECTURA", jefe_mantencion: "LECTURA", jefe_construccion: "OCULTO", firmware: "OCULTO", tecnico: "OCULTO", coordinador: "OCULTO" },
  firmware: { desarrollo: "LECTURA", gerencia: "ESCRITURA", jefe_mantencion: "LECTURA", jefe_construccion: "LECTURA", firmware: "ESCRITURA", tecnico: "LECTURA", coordinador: "OCULTO" },
  // Panel de administración (creación de usuarios): solo Desarrollo, Gerencia y ambas jefaturas.
  admin: { desarrollo: "ESCRITURA", gerencia: "ESCRITURA", jefe_mantencion: "ESCRITURA", jefe_construccion: "ESCRITURA", firmware: "OCULTO", tecnico: "OCULTO", coordinador: "OCULTO" },
};

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const roles = Object.fromEntries(
    await Promise.all(
      Object.keys(PERMISOS_MODULO.iot).map(async (nombre) => [
        nombre,
        await prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } }),
      ]),
    ),
  );

  // El rol "jefatura" único se dividió en jefe_construccion (Carlos Salas) y
  // jefe_mantencion (Víctor Aburto). En una BD que venía del esquema anterior
  // queda huérfano tras reasignar a Víctor; se elimina solo si ya no lo usa
  // nadie, para que no aparezca en el selector de "Nuevo usuario".
  const jefaturaObsoleta = await prisma.rol.findFirst({ where: { nombre: "jefatura" }, include: { usuariosRol: true } });
  if (jefaturaObsoleta && jefaturaObsoleta.usuariosRol.length === 0) {
    await prisma.rolModuloPermiso.deleteMany({ where: { rolId: jefaturaObsoleta.id } });
    await prisma.rol.delete({ where: { id: jefaturaObsoleta.id } });
  }

  // Áreas organizativas (etiquetas sin efecto RBAC, usadas para dirigir avisos).
  const areas = Object.fromEntries(
    await Promise.all(
      ["Obras", "Mantención"].map(async (nombre) => [nombre, await prisma.area.upsert({ where: { nombre }, update: {}, create: { nombre } })]),
    ),
  );

  // Reemplaza correos antiguos (*.local) por los corporativos reales, sin
  // duplicar filas. Multi-rol/multi-área: reemplaza el set completo en cada
  // corrida (idempotente) en vez de acumular duplicados.
  async function upsertUsuario(nombre: string, email: string, rolIds: number[], areaIds: number[] = [], emailAnterior?: string) {
    const existente =
      (await prisma.usuario.findUnique({ where: { email } })) ??
      (emailAnterior ? await prisma.usuario.findUnique({ where: { email: emailAnterior } }) : null);
    if (existente) {
      return prisma.usuario.update({
        where: { id: existente.id },
        data: {
          nombre,
          email,
          passwordHash,
          roles: { deleteMany: {}, create: rolIds.map((rolId) => ({ rolId })) },
          areas: { deleteMany: {}, create: areaIds.map((areaId) => ({ areaId })) },
        },
      });
    }
    return prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        roles: { create: rolIds.map((rolId) => ({ rolId })) },
        areas: { create: areaIds.map((areaId) => ({ areaId })) },
      },
    });
  }

  // Elías: desarrollo, pero también apoya en Mantención. Febe: firmware, con
  // el mismo apoyo. Ejemplos de multi-rol/área pedidos explícitamente.
  await upsertUsuario("Elías Guajardo", "e.guajardo@cjtraffic.cl", [roles.desarrollo.id], [areas["Mantención"].id], "elias.guajardo@cjtraffic.local");
  await upsertUsuario("Febe Benecke", "n.benecke@cjtraffic.cl", [roles.firmware.id], [areas["Mantención"].id], "febe.benecke@cjtraffic.local");
  await upsertUsuario("Víctor Aburto", "v.aburto@cjtraffic.cl", [roles.jefe_mantencion.id], [areas["Mantención"].id]);
  const javier = await upsertUsuario("Javier Smith", "j.smith@cjtraffic.cl", [roles.gerencia.id]);

  // Jefe de Construcción y coordinadores de proyecto del área de Obras.
  const carlosSalas = await upsertUsuario("Carlos Salas", "c.salas@cjtraffic.cl", [roles.jefe_construccion.id], [areas["Obras"].id]);
  const javieraOrozco = await upsertUsuario("Javiera Orozco", "j.orozco@cjtraffic.cl", [roles.coordinador.id], [areas["Obras"].id]);
  const nelsonOpazo = await upsertUsuario("Nelson Opazo", "n.opazo@cjtraffic.cl", [roles.coordinador.id], [areas["Obras"].id]);
  const juanAcuna = await upsertUsuario("Juan Acuña", "j.acuna@cjtraffic.cl", [roles.coordinador.id], [areas["Obras"].id]);

  for (const [clave, nombre] of Object.entries({ iot: "Mantenedor IoT", firmware: "Firmware", admin: "Administración" })) {
    const modulo = await prisma.modulo.upsert({ where: { clave }, update: {}, create: { clave, nombre } });
    for (const [rolNombre, nivel] of Object.entries(PERMISOS_MODULO[clave])) {
      await prisma.rolModuloPermiso.upsert({
        where: { rolId_moduloId: { rolId: roles[rolNombre].id, moduloId: modulo.id } },
        update: { nivel },
        create: { rolId: roles[rolNombre].id, moduloId: modulo.id, nivel },
      });
    }
  }

  for (const nombre of ["Gateway", "Repuesto", "Otro"]) {
    await prisma.categoriaInventario.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // ── Proyectos de ejemplo (motor operativo de Obras) ──
  // Idempotente: si la obra ya existe por su código, no se recrea (para no
  // duplicar tracks ni bitácora). Los días "atrás" ubican los hitos en el tiempo
  // para que el Panel Ejecutivo muestre datos realistas ("hitos de la semana").
  const dia = 24 * 60 * 60 * 1000;
  async function seedObra(o: {
    codigoObra: string;
    nombre: string;
    cliente: string;
    tipoObra: string;
    faseGlobal: string;
    presupuesto: number;
    costoAcumulado: number;
    coordinadorId: number | null;
    tracks: { tipo: string; estadoActual: string; responsableId?: number | null }[];
    bitacora: { autorId: number; tipoEvento: string; mensaje: string; diasAtras: number }[];
  }) {
    if (await prisma.obra.findUnique({ where: { codigoObra: o.codigoObra } })) return;
    await prisma.obra.create({
      data: {
        codigoObra: o.codigoObra,
        nombre: o.nombre,
        cliente: o.cliente,
        tipoObra: o.tipoObra,
        faseGlobal: o.faseGlobal as never,
        presupuesto: o.presupuesto,
        costoAcumulado: o.costoAcumulado,
        subgerenteId: javier.id,
        coordinadorId: o.coordinadorId,
        fechaInicio: new Date(Date.now() - 30 * dia),
        tracks: {
          create: o.tracks.map((t) => ({ tipo: t.tipo as never, estadoActual: t.estadoActual, responsableId: t.responsableId ?? null })),
        },
        bitacora: {
          create: o.bitacora.map((b) => ({
            autorId: b.autorId,
            tipoEvento: b.tipoEvento,
            mensaje: b.mensaje,
            createdAt: new Date(Date.now() - b.diasAtras * dia),
          })),
        },
      },
    });
  }

  await seedObra({
    codigoObra: "OBR-2026-045",
    nombre: "Semáforo Av. Kennedy / Manquehue",
    cliente: "Municipalidad de Las Condes",
    tipoObra: "NUEVO_SEMAFORO",
    faseGlobal: "GESTION",
    presupuesto: 45_000_000,
    costoAcumulado: 12_000_000,
    coordinadorId: carlosSalas.id,
    tracks: [
      { tipo: "PERMISOS", estadoActual: "ESPERANDO_ORGANISMO", responsableId: carlosSalas.id },
      { tipo: "ADQUISICIONES", estadoActual: "ORDEN_COMPRA" },
      { tipo: "PROGRAMACION", estadoActual: "BLOQUEADO" },
      { tipo: "INSTALACION", estadoActual: "PLANIFICACION" },
    ],
    bitacora: [
      { autorId: javier.id, tipoEvento: "CREACION", mensaje: "Requerimiento recibido desde Ventas — alcance: 4 cruces.", diasAtras: 13 },
      { autorId: carlosSalas.id, tipoEvento: "HITO", mensaje: "Expediente de permiso ingresado a la municipalidad — folio 2026-0451.", diasAtras: 10 },
      { autorId: carlosSalas.id, tipoEvento: "HITO", mensaje: "Solicitud de materiales enviada a Bodega — lista de 12 ítems.", diasAtras: 6 },
      { autorId: carlosSalas.id, tipoEvento: "ALERTA", mensaje: "Programación bloqueada: aún no se realiza el estudio vial del cruce principal.", diasAtras: 2 },
    ],
  });

  await seedObra({
    codigoObra: "OBR-2026-039",
    nombre: "Modificación Cruce Vespucio / Grecia",
    cliente: "MOP — Dirección de Vialidad",
    tipoObra: "MODIFICACION",
    faseGlobal: "EJECUCION",
    presupuesto: 22_000_000,
    costoAcumulado: 18_500_000,
    coordinadorId: javieraOrozco.id,
    tracks: [
      { tipo: "PERMISOS", estadoActual: "APROBADO" },
      { tipo: "ADQUISICIONES", estadoActual: "DESPACHADO" },
      { tipo: "PROGRAMACION", estadoActual: "APROBADO", responsableId: javieraOrozco.id },
      { tipo: "INSTALACION", estadoActual: "EN_TERRENO", responsableId: javieraOrozco.id },
    ],
    bitacora: [
      { autorId: javieraOrozco.id, tipoEvento: "HITO", mensaje: "Programación aprobada tras prueba en banco.", diasAtras: 5 },
      { autorId: javieraOrozco.id, tipoEvento: "HITO", mensaje: "Materiales despachados a terreno.", diasAtras: 4 },
      { autorId: javieraOrozco.id, tipoEvento: "HITO", mensaje: "Cuadrilla en terreno: instalación en curso.", diasAtras: 1 },
    ],
  });

  await seedObra({
    codigoObra: "OBR-2026-051",
    nombre: "CCTV Ruta 68 Sector Túnel",
    cliente: "Concesionaria Ruta 68",
    tipoObra: "CCTV",
    faseGlobal: "INICIO",
    presupuesto: 30_000_000,
    costoAcumulado: 1_500_000,
    coordinadorId: juanAcuna.id,
    tracks: [
      { tipo: "PERMISOS", estadoActual: "NO_INICIADO" },
      { tipo: "ADQUISICIONES", estadoActual: "PLANIFICACION" },
      { tipo: "PROGRAMACION", estadoActual: "ESPERANDO_REQUERIMIENTOS" },
      { tipo: "COMUNICACIONES", estadoActual: "SOLICITADO", responsableId: juanAcuna.id },
    ],
    bitacora: [
      { autorId: javier.id, tipoEvento: "CREACION", mensaje: "Proyecto creado desde requerimiento de Ventas.", diasAtras: 3 },
      { autorId: juanAcuna.id, tipoEvento: "HITO", mensaje: "Solicitud de enlace enviada a Servicio Técnico.", diasAtras: 2 },
    ],
  });

  await seedObra({
    codigoObra: "OBR-2026-047",
    nombre: "Semáforo Peatonal Colegio San José",
    cliente: "Municipalidad de Maipú",
    tipoObra: "NUEVO_SEMAFORO",
    faseGlobal: "GESTION",
    presupuesto: 15_000_000,
    costoAcumulado: 6_200_000,
    coordinadorId: nelsonOpazo.id,
    tracks: [
      { tipo: "PERMISOS", estadoActual: "APROBADO" },
      { tipo: "ADQUISICIONES", estadoActual: "COTIZANDO" },
      { tipo: "PROGRAMACION", estadoActual: "EN_BANCO" },
      { tipo: "INSTALACION", estadoActual: "PLANIFICACION" },
    ],
    bitacora: [
      { autorId: nelsonOpazo.id, tipoEvento: "HITO", mensaje: "Permiso municipal aprobado.", diasAtras: 8 },
      { autorId: nelsonOpazo.id, tipoEvento: "HITO", mensaje: "Cotización de controlador solicitada a 2 proveedores.", diasAtras: 3 },
    ],
  });

  // ── Subtareas de ejemplo por track (kanban) ──
  // Checklist de subprocesos del wireframe. Idempotente: solo se crean si el
  // track aún no tiene subtareas. El estado (kanban) se deriva del avance del
  // track para que cada proyecto muestre un tablero coherente con su fase.
  const CHECKLIST: Record<string, string[]> = {
    PERMISOS: ["Preparar expediente", "Ingresar a organismo", "Respuesta / observaciones", "Permiso aprobado"],
    ADQUISICIONES: ["Solicitud a Bodega", "Cotización", "Orden de compra", "Pago", "Recepción", "Despacho a terreno"],
    PROGRAMACION: ["Estudio vial disponible", "Programar controlador", "Prueba en banco"],
    INSTALACION: ["Preparar cuadrilla", "Instalación en terreno", "Puesta en marcha"],
    COMUNICACIONES: ["Solicitud de enlace", "Configuración", "Enlace operativo"],
  };
  // Fracción de avance implícita según el estado textual del track.
  function fraccionAvance(estado: string): number {
    if (/APROBAD|DESPACHAD|OPERATIV|EN_TERRENO|RECIBID|FINALIZAD/.test(estado)) return 1;
    if (/ORDEN_COMPRA|COTIZAND|EN_BANCO|CONFIGURAC/.test(estado)) return 0.5;
    if (/ESPERANDO_ORGANISMO|SOLICITAD|EN_TRAMITE/.test(estado)) return 0.34;
    return 0; // BLOQUEADO, NO_INICIADO, PLANIFICACION, ESPERANDO_REQUERIMIENTOS
  }

  const obrasEjemplo = await prisma.obra.findMany({
    where: { codigoObra: { in: ["OBR-2026-045", "OBR-2026-039", "OBR-2026-051", "OBR-2026-047"] } },
    include: { tracks: { include: { subtareas: { select: { id: true } } } } },
  });
  for (const obra of obrasEjemplo) {
    for (const track of obra.tracks) {
      if (track.subtareas.length > 0) continue;
      const titulos = CHECKLIST[track.tipo] ?? [];
      if (titulos.length === 0) continue;
      const hechas = Math.floor(fraccionAvance(track.estadoActual) * titulos.length);
      await prisma.obraSubtarea.createMany({
        data: titulos.map((titulo, i) => ({
          trackId: track.id,
          titulo,
          orden: i,
          estado: i < hechas ? "HECHO" : i === hechas && hechas < titulos.length ? "EN_PROGRESO" : "POR_HACER",
        })),
      });
    }
  }

  // ── Aviso de ejemplo (panel de administración → Avisos) ──
  const tituloAvisoEjemplo = "Bienvenida al nuevo panel de administración";
  if (!(await prisma.aviso.findFirst({ where: { titulo: tituloAvisoEjemplo } }))) {
    await prisma.aviso.create({
      data: {
        titulo: tituloAvisoEjemplo,
        cuerpo: "Ahora se pueden asignar múltiples roles y áreas por usuario, y publicar avisos dirigidos a todos, un área o un rol específico.",
        tipo: "INFO",
        presentacion: "BANNER",
        audienciaTipo: "TODOS",
        autorId: javier.id,
      },
    });
  }

  console.log("Seed completo: roles, permisos, usuarios, categorías de inventario y proyectos de ejemplo.");
  console.log(`Usuarios de prueba (password: ${DEV_PASSWORD}): e.guajardo@cjtraffic.cl, n.benecke@cjtraffic.cl, v.aburto@cjtraffic.cl, j.smith@cjtraffic.cl`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
