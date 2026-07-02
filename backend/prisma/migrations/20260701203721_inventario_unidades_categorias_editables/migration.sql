/*
  Warnings:

  - You are about to drop the column `cantidad` on the `ItemInventario` table. All the data in the column will be lost.
  - You are about to drop the column `categoria` on the `ItemInventario` table. All the data in the column will be lost.
  - Added the required column `categoriaId` to the `ItemInventario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ItemInventario" DROP COLUMN "cantidad",
DROP COLUMN "categoria",
ADD COLUMN     "categoriaId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "CategoriaInventario";

-- CreateTable
CREATE TABLE "CategoriaInventario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadInventario" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "codigoUnidad" TEXT NOT NULL,
    "cruceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnidadInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaInventario_nombre_key" ON "CategoriaInventario"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadInventario_cruceId_key" ON "UnidadInventario"("cruceId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadInventario_itemId_codigoUnidad_key" ON "UnidadInventario"("itemId", "codigoUnidad");

-- AddForeignKey
ALTER TABLE "ItemInventario" ADD CONSTRAINT "ItemInventario_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadInventario" ADD CONSTRAINT "UnidadInventario_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadInventario" ADD CONSTRAINT "UnidadInventario_cruceId_fkey" FOREIGN KEY ("cruceId") REFERENCES "Cruce"("id") ON DELETE SET NULL ON UPDATE CASCADE;
