/*
  Warnings:

  - Added the required column `passwordHash` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NivelAcceso" AS ENUM ('OCULTO', 'LECTURA', 'ESCRITURA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Modulo" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolModuloPermiso" (
    "id" SERIAL NOT NULL,
    "rolId" INTEGER NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "nivel" "NivelAcceso" NOT NULL DEFAULT 'OCULTO',

    CONSTRAINT "RolModuloPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Modulo_clave_key" ON "Modulo"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "RolModuloPermiso_rolId_moduloId_key" ON "RolModuloPermiso"("rolId", "moduloId");

-- AddForeignKey
ALTER TABLE "RolModuloPermiso" ADD CONSTRAINT "RolModuloPermiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolModuloPermiso" ADD CONSTRAINT "RolModuloPermiso_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
