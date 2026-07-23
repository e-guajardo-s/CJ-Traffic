-- CreateEnum
CREATE TYPE "PrioridadSubtarea" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoTrack_new" AS ENUM ('PERMISOS', 'ADQUISICIONES', 'PROGRAMACION', 'INSTALACION', 'COMUNICACIONES', 'ENLACES', 'EMPALMES', 'HITOS_UOCT', 'SINTONIA_FINA', 'TRASPASOS_MANTENCION');
ALTER TABLE "ObraTrack" ALTER COLUMN "tipo" TYPE "TipoTrack_new" USING ("tipo"::text::"TipoTrack_new");
ALTER TYPE "TipoTrack" RENAME TO "TipoTrack_old";
ALTER TYPE "TipoTrack_new" RENAME TO "TipoTrack";
DROP TYPE "public"."TipoTrack_old";
COMMIT;

-- AlterTable
ALTER TABLE "ObraSubtarea" ADD COLUMN     "asignadoId" INTEGER,
ADD COLUMN     "fechaInicio" TIMESTAMP(3),
ADD COLUMN     "prioridad" "PrioridadSubtarea" NOT NULL DEFAULT 'MEDIA';

-- AddForeignKey
ALTER TABLE "ObraSubtarea" ADD CONSTRAINT "ObraSubtarea_asignadoId_fkey" FOREIGN KEY ("asignadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

