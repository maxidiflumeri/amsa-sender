-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reporte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "enviadoAt" DATETIME,
    "campañaId" INTEGER,
    CONSTRAINT "Reporte_campañaId_fkey" FOREIGN KEY ("campañaId") REFERENCES "Campaña" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reporte" ("campañaId", "enviadoAt", "estado", "id", "mensaje", "numero") SELECT "campañaId", "enviadoAt", "estado", "id", "mensaje", "numero" FROM "Reporte";
DROP TABLE "Reporte";
ALTER TABLE "new_Reporte" RENAME TO "Reporte";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
