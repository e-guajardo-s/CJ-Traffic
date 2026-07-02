-- CreateEnum
CREATE TYPE "CategoriaInventario" AS ENUM ('GATEWAY', 'CONTROLADOR', 'REPUESTO', 'OTRO');

-- CreateTable
CREATE TABLE "ItemInventario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaInventario" NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "ubicacion" TEXT,
    "umbralMinimo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemInventario_pkey" PRIMARY KEY ("id")
);
