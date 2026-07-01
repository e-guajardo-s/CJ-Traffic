-- CreateEnum
CREATE TYPE "EstadoGateway" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADADO');

-- CreateEnum
CREATE TYPE "EstadoProgramacion" AS ENUM ('EN_COLA', 'EN_PRUEBA', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rolId" INTEGER NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cruce" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "controlador" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cruce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayIot" (
    "id" SERIAL NOT NULL,
    "cruceId" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "simApn" TEXT NOT NULL,
    "estado" "EstadoGateway" NOT NULL DEFAULT 'OFFLINE',
    "ultimaSenalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayIot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programacion" (
    "id" SERIAL NOT NULL,
    "cruceId" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoUrl" TEXT,
    "estado" "EstadoProgramacion" NOT NULL DEFAULT 'EN_COLA',
    "subidoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "programacionId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "aprobado" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cruce_codigo_key" ON "Cruce"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayIot_cruceId_key" ON "GatewayIot"("cruceId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayIot" ADD CONSTRAINT "GatewayIot_cruceId_fkey" FOREIGN KEY ("cruceId") REFERENCES "Cruce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programacion" ADD CONSTRAINT "Programacion_cruceId_fkey" FOREIGN KEY ("cruceId") REFERENCES "Cruce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programacion" ADD CONSTRAINT "Programacion_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_programacionId_fkey" FOREIGN KEY ("programacionId") REFERENCES "Programacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
