-- CreateTable
CREATE TABLE "ArchivoTecnico" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "url" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "proyectoId" INTEGER,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoTecnico_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ArchivoTecnico" ADD CONSTRAINT "ArchivoTecnico_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
