-- CreateTable
CREATE TABLE "TerminoGlosario" (
    "id" SERIAL NOT NULL,
    "termino" TEXT NOT NULL,
    "definicion" TEXT NOT NULL,

    CONSTRAINT "TerminoGlosario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TerminoGlosario_termino_key" ON "TerminoGlosario"("termino");
