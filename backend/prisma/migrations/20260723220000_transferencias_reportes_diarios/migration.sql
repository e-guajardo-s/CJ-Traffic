-- CreateTable
CREATE TABLE "ObraCoordinadorExtra" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "coordinadorId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "vigenteHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObraCoordinadorExtra_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ReporteDiario" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackId" INTEGER,
    "personal" INTEGER,
    "clima" TEXT,
    "horasTrabajadas" DECIMAL(5,2),
    "trabajoRealizado" TEXT NOT NULL,
    "materiales" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReporteDiario_pkey" PRIMARY KEY ("id")
);
-- AddForeignKey
ALTER TABLE "ObraCoordinadorExtra" ADD CONSTRAINT "ObraCoordinadorExtra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ObraCoordinadorExtra" ADD CONSTRAINT "ObraCoordinadorExtra_coordinadorId_fkey" FOREIGN KEY ("coordinadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ReporteDiario" ADD CONSTRAINT "ReporteDiario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ReporteDiario" ADD CONSTRAINT "ReporteDiario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
