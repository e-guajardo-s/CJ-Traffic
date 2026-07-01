-- CreateTable
CREATE TABLE "BitacoraEntry" (
    "id" SERIAL NOT NULL,
    "autorId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "detalle" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitacoraEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BitacoraEntry" ADD CONSTRAINT "BitacoraEntry_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
