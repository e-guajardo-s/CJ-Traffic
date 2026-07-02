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

  await upsertUsuario("Elías Guajardo", "e.guajardo@cjtraffic.cl", roles.desarrollo.id, "elias.guajardo@cjtraffic.local");
  await upsertUsuario("Febe Benecke", "n.benecke@cjtraffic.cl", roles.firmware.id, "febe.benecke@cjtraffic.local");
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

  for (const nombre of ["Gateway", "Repuesto", "Otro"]) {
    await prisma.categoriaInventario.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  console.log("Seed completo: roles, permisos, usuarios y categorías de inventario.");
  console.log(`Usuarios de prueba (password: ${DEV_PASSWORD}): e.guajardo@cjtraffic.cl, n.benecke@cjtraffic.cl, v.aburto@cjtraffic.cl, j.smith@cjtraffic.cl`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
