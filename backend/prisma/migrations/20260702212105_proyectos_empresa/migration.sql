-- CreateTable
CREATE TABLE "ProyectoEmpresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'NO_INICIADO',
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "responsableId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProyectoEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaEmpresa" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "proyectoEmpresaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TareaEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaEmpresa" (
    "id" SERIAL NOT NULL,
    "contenido" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "proyectoEmpresaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaEmpresa_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProyectoEmpresa" ADD CONSTRAINT "ProyectoEmpresa_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaEmpresa" ADD CONSTRAINT "TareaEmpresa_proyectoEmpresaId_fkey" FOREIGN KEY ("proyectoEmpresaId") REFERENCES "ProyectoEmpresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaEmpresa" ADD CONSTRAINT "NotaEmpresa_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaEmpresa" ADD CONSTRAINT "NotaEmpresa_proyectoEmpresaId_fkey" FOREIGN KEY ("proyectoEmpresaId") REFERENCES "ProyectoEmpresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
