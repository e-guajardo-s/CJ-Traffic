-- CreateEnum
CREATE TYPE "TipoMantencion" AS ENUM ('PREVENTIVA', 'CORRECTIVA', 'INSTALACION', 'RETIRO', 'OTRA');

-- CreateTable
CREATE TABLE "MantencionGateway" (
    "id" SERIAL NOT NULL,
    "gatewayId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMantencion" NOT NULL DEFAULT 'PREVENTIVA',
    "tecnico" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantencionGateway_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MantencionGateway" ADD CONSTRAINT "MantencionGateway_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "GatewayIot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
