import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
  const rolDesarrollo = await prisma.rol.upsert({
    where: { nombre: "desarrollo" },
    update: {},
    create: { nombre: "desarrollo" },
  });
  const rolFirmware = await prisma.rol.upsert({
    where: { nombre: "firmware" },
    update: {},
    create: { nombre: "firmware" },
  });

  const elias = await prisma.usuario.upsert({
    where: { email: "elias.guajardo@cjtraffic.local" },
    update: {},
    create: { nombre: "Elías Guajardo", email: "elias.guajardo@cjtraffic.local", rolId: rolDesarrollo.id },
  });
  const febe = await prisma.usuario.upsert({
    where: { email: "febe.benecke@cjtraffic.local" },
    update: {},
    create: { nombre: "Febe Benecke", email: "febe.benecke@cjtraffic.local", rolId: rolFirmware.id },
  });

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

  console.log("Seed completo: roles, usuarios, cruces, gateways IoT, programaciones y feedback.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
