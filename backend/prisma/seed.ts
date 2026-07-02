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
const PERMISOS_MODULO: Record<string, Record<string, "OCULTO" | "LECTURA" | "ESCRITURA">> = {
  iot: { desarrollo: "ESCRITURA", gerencia: "LECTURA", jefatura: "LECTURA", firmware: "OCULTO", tecnico: "OCULTO" },
  firmware: { desarrollo: "LECTURA", gerencia: "ESCRITURA", jefatura: "LECTURA", firmware: "ESCRITURA", tecnico: "LECTURA" },
  // Panel de administración (creación de usuarios): solo Desarrollo, Gerencia y Jefatura.
  admin: { desarrollo: "ESCRITURA", gerencia: "ESCRITURA", jefatura: "ESCRITURA", firmware: "OCULTO", tecnico: "OCULTO" },
};

// Datos reales extraídos de legacy/prototype.html (arrays `iotRows` y `firmwares`).
const CRUCES = [
  { codigo: "CRX-001", ubicacion: "Rosario Norte / Apoquindo", controlador: "Auter A5" },
  { codigo: "CRX-002", ubicacion: "Av. Grecia / Marathon", controlador: "Auter A5" },
  { codigo: "CRX-003", ubicacion: "V. Mackenna / Departamental", controlador: "Auter A4F" },
  { codigo: "CRX-004", ubicacion: "Maipú Centro / 5 de Abril", controlador: "Auter A5" },
  { codigo: "CRX-005", ubicacion: "Los Pajaritos / Las Torres", controlador: "Peek ATC-1000" },
];

const GATEWAYS: Record<string, { modelo: string; simApn: string; estado: "ONLINE" | "OFFLINE" | "DEGRADADO" }> = {
  "CRX-001": { modelo: "Teltonika TRB256", simApn: "Entel M2M", estado: "ONLINE" },
  "CRX-002": { modelo: "Teltonika TRB145", simApn: "Entel M2M", estado: "ONLINE" },
  "CRX-003": { modelo: "Teltonika TRB256", simApn: "Movistar IoT", estado: "OFFLINE" },
  "CRX-004": { modelo: "Teltonika RUT241", simApn: "Entel M2M", estado: "ONLINE" },
  "CRX-005": { modelo: "Teltonika TRB256", simApn: "Claro M2M", estado: "DEGRADADO" },
};

// Ciclo de vida de instalación (demo): cubre los 4 estados de la tabla de Directorio.
// Solo se aplica como backfill si el gateway nunca fue editado (fechas/mantención nulas).
const LIFECYCLE: Record<string, { fechaInstalacion: Date | null; fechaDesinstalacion: Date | null; enMantencion: boolean }> = {
  "CRX-001": { fechaInstalacion: new Date("2025-03-10"), fechaDesinstalacion: null, enMantencion: true }, // verde
  "CRX-002": { fechaInstalacion: new Date("2025-01-15"), fechaDesinstalacion: null, enMantencion: false }, // gris (sin mantención)
  "CRX-003": { fechaInstalacion: null, fechaDesinstalacion: null, enMantencion: true }, // sin instalar
  "CRX-004": { fechaInstalacion: new Date("2025-02-01"), fechaDesinstalacion: null, enMantencion: true }, // verde
  "CRX-005": { fechaInstalacion: new Date("2024-11-05"), fechaDesinstalacion: new Date("2026-06-20"), enMantencion: true }, // desinstalado
};

const FIRMWARES = [
  {
    cruceCodigo: "CRX-001",
    version: "v2.4.0",
    archivoNombre: "auter_a5_rosario_v2.4.0.bin",
    estado: "EN_PRUEBA" as const,
  },
  {
    cruceCodigo: "CRX-002",
    version: "v1.9.2",
    archivoNombre: "auter_a5_grecia_v1.9.2.bin",
    estado: "RECHAZADO" as const,
    feedback: "Relé 4 no conmuta en plan nocturno. Revisar tabla de fases.",
  },
  {
    // "Conexión UOCT Maipú" en el prototipo — se asocia al cruce más cercano (CRX-004, Maipú Centro).
    cruceCodigo: "CRX-004",
    version: "v2.3.5",
    archivoNombre: "auter_a5_maipu_v2.3.5.bin",
    estado: "APROBADO" as const,
    feedback: "Prueba de banco OK. Instalado en terreno.",
  },
];

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

  // Reemplaza correos antiguos (*.local) por los corporativos reales, sin duplicar filas.
  async function upsertUsuario(nombre: string, email: string, rolId: number, emailAnterior?: string) {
    const existente =
      (await prisma.usuario.findUnique({ where: { email } })) ??
      (emailAnterior ? await prisma.usuario.findUnique({ where: { email: emailAnterior } }) : null);
    if (existente) {
      return prisma.usuario.update({ where: { id: existente.id }, data: { nombre, email, passwordHash, rolId } });
    }
    return prisma.usuario.create({ data: { nombre, email, passwordHash, rolId } });
  }

  const elias = await upsertUsuario("Elías Guajardo", "e.guajardo@cjtraffic.cl", roles.desarrollo.id, "elias.guajardo@cjtraffic.local");
  const febe = await upsertUsuario("Febe Benecke", "n.benecke@cjtraffic.cl", roles.firmware.id, "febe.benecke@cjtraffic.local");
  await upsertUsuario("Víctor Aburto", "v.aburto@cjtraffic.cl", roles.jefatura.id);
  await upsertUsuario("Javier Smith", "j.smith@cjtraffic.cl", roles.gerencia.id);

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

  for (const c of CRUCES) {
    const cruce = await prisma.cruce.upsert({
      where: { codigo: c.codigo },
      update: {},
      create: c,
    });
    const gw = GATEWAYS[c.codigo];
    // Los 5 cruces demo del prototipo siempre reflejan el ciclo de vida definido en LIFECYCLE
    // (showcase de los 4 estados); los campos de conectividad (`estado`) sí se preservan vía
    // `update: {}` para no pisar ediciones reales hechas desde la UI.
    await prisma.gatewayIot.upsert({
      where: { cruceId: cruce.id },
      update: LIFECYCLE[c.codigo],
      create: { cruceId: cruce.id, ...gw, ...LIFECYCLE[c.codigo] },
    });
  }

  for (const f of FIRMWARES) {
    const yaExiste = await prisma.programacion.findFirst({ where: { archivoNombre: f.archivoNombre } });
    if (yaExiste) continue;

    const cruce = await prisma.cruce.findUniqueOrThrow({ where: { codigo: f.cruceCodigo } });
    const programacion = await prisma.programacion.create({
      data: {
        cruceId: cruce.id,
        version: f.version,
        archivoNombre: f.archivoNombre,
        estado: f.estado,
        subidoPorId: febe.id,
      },
    });
    if (f.feedback) {
      await prisma.feedback.create({
        data: {
          programacionId: programacion.id,
          autorId: elias.id,
          comentario: f.feedback,
          aprobado: f.estado === "APROBADO",
        },
      });
    }
  }

  for (const nombre of ["Gateway", "Repuesto", "Otro"]) {
    await prisma.categoriaInventario.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  console.log("Seed completo: roles, permisos, usuarios, cruces, gateways IoT, programaciones y feedback.");
  console.log(`Usuarios de prueba (password: ${DEV_PASSWORD}): e.guajardo@cjtraffic.cl, n.benecke@cjtraffic.cl, v.aburto@cjtraffic.cl, j.smith@cjtraffic.cl`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
