/*
  Warnings:

  - You are about to drop the column `ubicacion` on the `ItemInventario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ItemInventario" DROP COLUMN "ubicacion",
ADD COLUMN     "precio" INTEGER;

-- AlterTable
ALTER TABLE "UnidadInventario" ADD COLUMN     "ubicacionFisica" TEXT;
