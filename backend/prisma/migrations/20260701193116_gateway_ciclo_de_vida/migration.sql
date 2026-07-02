-- AlterTable
ALTER TABLE "GatewayIot" ADD COLUMN     "enMantencion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaDesinstalacion" TIMESTAMP(3),
ADD COLUMN     "fechaInstalacion" TIMESTAMP(3);
