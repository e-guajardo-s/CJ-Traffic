-- CreateEnum
CREATE TYPE "FaseObra" AS ENUM ('INICIO', 'GESTION', 'EJECUCION', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoTrack" AS ENUM ('PERMISOS', 'ADQUISICIONES', 'PROGRAMACION', 'INSTALACION', 'COMUNICACIONES');

-- CreateEnum
CREATE TYPE "EstadoSol" AS ENUM ('SOLICITADO', 'COTIZANDO', 'ORDEN_COMPRA', 'RECIBIDO', 'DESPACHADO');

-- CreateTable
CREATE TABLE "Obra" (
    "id" SERIAL NOT NULL,
    "codigoObra" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "tipoObra" TEXT NOT NULL,
    "faseGlobal" "FaseObra" NOT NULL DEFAULT 'INICIO',
    "presupuesto" DECIMAL(65,30),
    "costoAcumulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subgerenteId" INTEGER,
    "coordinadorId" INTEGER,
    "fechaInicio" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraTrack" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "tipo" "TipoTrack" NOT NULL,
    "estadoActual" TEXT NOT NULL,
    "responsableId" INTEGER,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudMaterial" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "solicitanteId" INTEGER NOT NULL,
    "estado" "EstadoSol" NOT NULL,
    "costoTotal" DECIMAL(65,30),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemSolicitud" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "articuloDesc" TEXT NOT NULL,
    "itemId" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(65,30),

    CONSTRAINT "ItemSolicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramacionObra" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "programadorId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivoConfigUrl" TEXT,
    "estado" TEXT NOT NULL,
    "notasFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramacionObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipamientoTerreno" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "modeloExacto" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "notasInstalacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipamientoTerreno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraBitacora" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraBitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigoObra_key" ON "Obra"("codigoObra");

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_subgerenteId_fkey" FOREIGN KEY ("subgerenteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_coordinadorId_fkey" FOREIGN KEY ("coordinadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraTrack" ADD CONSTRAINT "ObraTrack_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraTrack" ADD CONSTRAINT "ObraTrack_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMaterial" ADD CONSTRAINT "SolicitudMaterial_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMaterial" ADD CONSTRAINT "SolicitudMaterial_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitud" ADD CONSTRAINT "ItemSolicitud_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitud" ADD CONSTRAINT "ItemSolicitud_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacionObra" ADD CONSTRAINT "ProgramacionObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacionObra" ADD CONSTRAINT "ProgramacionObra_programadorId_fkey" FOREIGN KEY ("programadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipamientoTerreno" ADD CONSTRAINT "EquipamientoTerreno_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraBitacora" ADD CONSTRAINT "ObraBitacora_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraBitacora" ADD CONSTRAINT "ObraBitacora_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
