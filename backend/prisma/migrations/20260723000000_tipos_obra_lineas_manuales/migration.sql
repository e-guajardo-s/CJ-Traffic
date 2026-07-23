-- AlterEnum
ALTER TYPE "TipoTrack" ADD VALUE 'OTRO';
-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "tipoObraDetalle" TEXT;
-- AlterTable
ALTER TABLE "ObraTrack" ADD COLUMN     "nombre" TEXT;
