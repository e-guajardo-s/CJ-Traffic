import { prisma } from "../prisma";

// Backfill puntual: agrega los tableros nuevos (Enlaces, Empalmes, Hitos
// UOCT, Sintonía Fina, Traspasos y Mantención) a las obras creadas
// antes de que estos TipoTrack existieran en el schema. Idempotente — si una
// obra ya tiene el track no lo duplica, así que se puede re-ejecutar sin riesgo.
const NUEVOS = [
  "ENLACES",
  "EMPALMES",
  "HITOS_UOCT",
  "SINTONIA_FINA",
  "TRASPASOS_MANTENCION",
] as const;

async function main() {
  const obras = await prisma.obra.findMany({ include: { tracks: { select: { tipo: true } } } });
  let creados = 0;
  for (const obra of obras) {
    const existentes = new Set(obra.tracks.map((t) => t.tipo));
    const faltantes = NUEVOS.filter((tipo) => !existentes.has(tipo));
    if (faltantes.length === 0) continue;

    await prisma.obraTrack.createMany({
      data: faltantes.map((tipo) => ({ obraId: obra.id, tipo, estadoActual: "NO_INICIADO" })),
    });
    creados += faltantes.length;
    console.log(`Obra ${obra.codigoObra} ("${obra.nombre}"): +${faltantes.length} tablero(s) → ${faltantes.join(", ")}`);
  }
  console.log(`\nListo. ${creados} tablero(s) creados en total sobre ${obras.length} obra(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
