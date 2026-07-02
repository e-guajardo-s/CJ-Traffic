/*
  Warnings:

  - You are about to drop the column `categoria` on the `ArchivoTecnico` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion` on the `ArchivoTecnico` table. All the data in the column will be lost.
  - You are about to drop the column `proyectoId` on the `ArchivoTecnico` table. All the data in the column will be lost.
  - Added the required column `tecnologiaId` to the `ArchivoTecnico` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ArchivoTecnico" DROP CONSTRAINT "ArchivoTecnico_proyectoId_fkey";

-- AlterTable
ALTER TABLE "ArchivoTecnico" DROP COLUMN "categoria",
DROP COLUMN "descripcion",
DROP COLUMN "proyectoId",
ADD COLUMN     "tecnologiaId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Tecnologia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT NOT NULL,
    "proyectoId" INTEGER,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tecnologia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Tecnologia" ADD CONSTRAINT "Tecnologia_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoTecnico" ADD CONSTRAINT "ArchivoTecnico_tecnologiaId_fkey" FOREIGN KEY ("tecnologiaId") REFERENCES "Tecnologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
