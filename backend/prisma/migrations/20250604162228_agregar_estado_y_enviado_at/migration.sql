-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN "enviadoAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaña" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoAt" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'no-enviada'
);
INSERT INTO "new_Campaña" ("createdAt", "enviadoAt", "id", "nombre") SELECT "createdAt", "enviadoAt", "id", "nombre" FROM "Campaña";
DROP TABLE "Campaña";
ALTER TABLE "new_Campaña" RENAME TO "Campaña";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
