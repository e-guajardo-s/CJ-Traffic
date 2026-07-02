// Limpieza única: elimina los cruces demo CRX-001..CRX-005 (heredados del
// prototipo) junto a sus gateways, programaciones de firmware y feedback.
// Las unidades de inventario asignadas a esos cruces vuelven a "disponible".
// Ejecutar con: npm run cleanup:demo
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CODIGOS_DEMO = ["CRX-001", "CRX-002", "CRX-003", "CRX-004", "CRX-005"];

async function main() {
  const cruces = await prisma.cruce.findMany({
    where: { codigo: { in: CODIGOS_DEMO } },
    include: { gateway: true, programaciones: true, unidadesAsignadas: true },
  });

  if (cruces.length === 0) {
    console.log("No quedan cruces demo (CRX-001..005) en la base de datos. Nada que hacer.");
    return;
  }

  for (const cruce of cruces) {
    await prisma.$transaction(async (tx) => {
      // Liberar unidades de inventario asignadas (vuelven a stock disponible).
      if (cruce.unidadesAsignadas.length > 0) {
        await tx.unidadInventario.updateMany({
          where: { cruceId: cruce.id },
          data: { cruceId: null },
        });
      }

      // Feedback → programaciones → gateway → cruce (orden por integridad referencial).
      const programacionIds = cruce.programaciones.map((p) => p.id);
      if (programacionIds.length > 0) {
        await tx.feedback.deleteMany({ where: { programacionId: { in: programacionIds } } });
        await tx.programacion.deleteMany({ where: { id: { in: programacionIds } } });
      }
      if (cruce.gateway) {
        await tx.gatewayIot.delete({ where: { cruceId: cruce.id } });
      }
      await tx.cruce.delete({ where: { id: cruce.id } });
    });

    console.log(
      `Eliminado ${cruce.codigo} (${cruce.ubicacion}) — gateway: ${cruce.gateway ? "sí" : "no"}, ` +
        `programaciones: ${cruce.programaciones.length}, unidades liberadas: ${cruce.unidadesAsignadas.length}`,
    );
  }

  console.log(`\nLimpieza completa: ${cruces.length} cruce(s) demo eliminados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
