-- CreateTable
CREATE TABLE "IncidenciaTroubleshooting" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "accionTomada" TEXT,
    "estado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyectoId" INTEGER,
    "autorId" INTEGER NOT NULL,

    CONSTRAINT "IncidenciaTroubleshooting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IncidenciaTroubleshooting" ADD CONSTRAINT "IncidenciaTroubleshooting_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidenciaTroubleshooting" ADD CONSTRAINT "IncidenciaTroubleshooting_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
