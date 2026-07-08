-- CreateTable
CREATE TABLE "ObraSubtarea" (
    "id" SERIAL NOT NULL,
    "trackId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'POR_HACER',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraSubtarea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ObraSubtarea" ADD CONSTRAINT "ObraSubtarea_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ObraTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
