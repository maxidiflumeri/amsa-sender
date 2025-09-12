-- AlterTable
ALTER TABLE `Campaña` ALTER COLUMN `createdAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `CampañaEmail` ALTER COLUMN `createdAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `CuentaSMTP` ALTER COLUMN `creadoAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `EmailDesuscripciones` ALTER COLUMN `createdAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `EmailEvento` ALTER COLUMN `fecha` DROP DEFAULT;

-- AlterTable
ALTER TABLE `EmailRebote` ALTER COLUMN `fecha` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ReporteEmail` ALTER COLUMN `creadoAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Template` ALTER COLUMN `createdAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `TemplateEmail` ALTER COLUMN `creadoAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Usuario` ALTER COLUMN `creadoAt` DROP DEFAULT;
