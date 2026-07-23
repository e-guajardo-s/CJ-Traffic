-- AlterEnum
ALTER TYPE "EstadoTarea" ADD VALUE 'BLOQUEADO';

-- AlterTable
ALTER TABLE "ObraSubtarea" ADD COLUMN     "fechaEstimadaDesbloqueo" TIMESTAMP(3);
