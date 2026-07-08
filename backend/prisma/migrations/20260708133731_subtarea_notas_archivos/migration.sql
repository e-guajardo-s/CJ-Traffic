-- AlterTable
ALTER TABLE "ObraSubtarea" ADD COLUMN     "notas" TEXT;

-- CreateTable
CREATE TABLE "ObraSubtareaArchivo" (
    "id" SERIAL NOT NULL,
    "subtareaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraSubtareaArchivo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ObraSubtareaArchivo" ADD CONSTRAINT "ObraSubtareaArchivo_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "ObraSubtarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
