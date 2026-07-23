-- AlterTable
ALTER TABLE "EstadoPago" ADD COLUMN     "archivoUrl" TEXT,
ADD COLUMN     "avanceAcumuladoPct" DECIMAL(6,4),
ADD COLUMN     "devAnticipo" DECIMAL(12,2),
ADD COLUMN     "emisor" TEXT,
ADD COLUMN     "iva" DECIMAL(12,2),
ADD COLUMN     "montoNeto" DECIMAL(12,2),
ADD COLUMN     "retencion" DECIMAL(12,2),
ADD COLUMN     "subtotal" DECIMAL(12,2),
ADD COLUMN     "totalPagar" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Subcontrato" ADD COLUMN     "devAnticipoPct" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "ivaPct" DECIMAL(5,4) NOT NULL DEFAULT 0.19,
ADD COLUMN     "montoAnticipo" DECIMAL(12,2),
ADD COLUMN     "numeroOc" TEXT,
ADD COLUMN     "retencionPct" DECIMAL(5,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PartidaPresupuesto" (
    "id" SERIAL NOT NULL,
    "subcontratoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "esCapitulo" BOOLEAN NOT NULL DEFAULT false,
    "itemNumero" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT,
    "cantidad" DECIMAL(12,2),
    "precioUnitario" DECIMAL(12,2),
    "total" DECIMAL(12,2),

    CONSTRAINT "PartidaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvancePartidaEP" (
    "id" SERIAL NOT NULL,
    "estadoPagoId" INTEGER NOT NULL,
    "partidaId" INTEGER NOT NULL,
    "avanceAcumuladoPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "avanceAnteriorPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "avanceActualPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "montoAcumulado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montoAnterior" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montoActual" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AvancePartidaEP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvancePartidaEP_estadoPagoId_partidaId_key" ON "AvancePartidaEP"("estadoPagoId", "partidaId");

-- AddForeignKey
ALTER TABLE "PartidaPresupuesto" ADD CONSTRAINT "PartidaPresupuesto_subcontratoId_fkey" FOREIGN KEY ("subcontratoId") REFERENCES "Subcontrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvancePartidaEP" ADD CONSTRAINT "AvancePartidaEP_estadoPagoId_fkey" FOREIGN KEY ("estadoPagoId") REFERENCES "EstadoPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvancePartidaEP" ADD CONSTRAINT "AvancePartidaEP_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "PartidaPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
