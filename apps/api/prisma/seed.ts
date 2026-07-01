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

  const elias = await prisma.usuario.upsert({
    where: { email: "elias.guajardo@cjtraffic.local" },
    update: {},
    create: { nombre: "Elías Guajardo", email: "elias.guajardo@cjtraffic.local", passwordHash, rolId: roles.desarrollo.id },
  });
  const febe = await prisma.usuario.upsert({
    where: { email: "febe.benecke@cjtraffic.local" },
    update: {},
    create: { nombre: "Febe Benecke", email: "febe.benecke@cjtraffic.local", passwordHash, rolId: roles.firmware.id },
  });

  for (const [clave, nombre] of Object.entries({ iot: "Mantenedor IoT", firmware: "Firmware" })) {
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
    await prisma.gatewayIot.upsert({
      where: { cruceId: cruce.id },
      update: {},
      create: { cruceId: cruce.id, ...gw },
    });
  }

  for (const f of FIRMWARES) {
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

  console.log("Seed completo: roles, permisos, usuarios, cruces, gateways IoT, programaciones y feedback.");
  console.log(`Login de prueba: elias.guajardo@cjtraffic.local / febe.benecke@cjtraffic.local — password: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
