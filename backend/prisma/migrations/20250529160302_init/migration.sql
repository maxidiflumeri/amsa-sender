-- CreateTable
CREATE TABLE "Campaña" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "campañaId" INTEGER NOT NULL,
    CONSTRAINT "Contacto_campañaId_fkey" FOREIGN KEY ("campañaId") REFERENCES "Campaña" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "campañaId" INTEGER NOT NULL,
    CONSTRAINT "Reporte_campañaId_fkey" FOREIGN KEY ("campañaId") REFERENCES "Campaña" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "estado" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_sessionId_key" ON "Sesion"("sessionId");
