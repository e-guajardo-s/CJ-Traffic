-- CreateTable
CREATE TABLE "ComponenteStack" (
    "id" SERIAL NOT NULL,
    "capa" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalles" TEXT,
    "proyectoId" INTEGER NOT NULL,

    CONSTRAINT "ComponenteStack_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ComponenteStack" ADD CONSTRAINT "ComponenteStack_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
