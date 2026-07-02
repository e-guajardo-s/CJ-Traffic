-- CreateTable
CREATE TABLE "Pizarra" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "contenido" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pizarra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pizarra_proyectoId_key" ON "Pizarra"("proyectoId");

-- AddForeignKey
ALTER TABLE "Pizarra" ADD CONSTRAINT "Pizarra_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
