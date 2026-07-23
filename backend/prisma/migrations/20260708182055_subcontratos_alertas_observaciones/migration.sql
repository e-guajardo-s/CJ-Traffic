-- AlterTable
ALTER TABLE "ObraSubtarea" ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "tipo" TEXT;

-- CreateTable
CREATE TABLE "Subcontrato" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "especialidad" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "montoContrato" DECIMAL(12,2) NOT NULL,
    "avancePlan" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avanceReal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcontrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstadoPago" (
    "id" SERIAL NOT NULL,
    "subcontratoId" INTEGER NOT NULL,
    "numeroEp" TEXT NOT NULL,
    "fechaEp" TIMESTAMP(3) NOT NULL,
    "montoEp" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstadoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraSubtareaNota" (
    "id" SERIAL NOT NULL,
    "subtareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraSubtareaNota_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Subcontrato" ADD CONSTRAINT "Subcontrato_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstadoPago" ADD CONSTRAINT "EstadoPago_subcontratoId_fkey" FOREIGN KEY ("subcontratoId") REFERENCES "Subcontrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraSubtareaNota" ADD CONSTRAINT "ObraSubtareaNota_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "ObraSubtarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraSubtareaNota" ADD CONSTRAINT "ObraSubtareaNota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

