/*
  Warnings:

  - You are about to drop the column `proyectoId` on the `Tecnologia` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Tecnologia" DROP CONSTRAINT "Tecnologia_proyectoId_fkey";

-- AlterTable
ALTER TABLE "Tecnologia" DROP COLUMN "proyectoId";

-- CreateTable
CREATE TABLE "_ProyectoToTecnologia" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProyectoToTecnologia_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProyectoToTecnologia_B_index" ON "_ProyectoToTecnologia"("B");

-- AddForeignKey
ALTER TABLE "_ProyectoToTecnologia" ADD CONSTRAINT "_ProyectoToTecnologia_A_fkey" FOREIGN KEY ("A") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProyectoToTecnologia" ADD CONSTRAINT "_ProyectoToTecnologia_B_fkey" FOREIGN KEY ("B") REFERENCES "Tecnologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
