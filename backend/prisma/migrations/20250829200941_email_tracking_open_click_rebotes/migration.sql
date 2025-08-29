/*
  Warnings:

  - A unique constraint covering the columns `[trackingTok]` on the table `ReporteEmail` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `contactoemail` DROP FOREIGN KEY `ContactoEmail_campañaId_fkey`;

-- DropForeignKey
ALTER TABLE `reporteemail` DROP FOREIGN KEY `ReporteEmail_campañaId_fkey`;

-- DropForeignKey
ALTER TABLE `reporteemail` DROP FOREIGN KEY `ReporteEmail_contactoId_fkey`;

-- DropIndex
DROP INDEX `ContactoEmail_campañaId_fkey` ON `contactoemail`;

-- AlterTable
ALTER TABLE `reporteemail` ADD COLUMN `primeroAbiertoAt` DATETIME(3) NULL,
    ADD COLUMN `primeroClickAt` DATETIME(3) NULL,
    ADD COLUMN `trackingTok` VARCHAR(191) NULL,
    MODIFY `html` MEDIUMTEXT NULL;

-- CreateTable
CREATE TABLE `EmailEvento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporteId` INTEGER NOT NULL,
    `tipo` ENUM('OPEN', 'CLICK') NOT NULL,
    `urlDestino` VARCHAR(191) NULL,
    `dominioDestino` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `deviceFamily` VARCHAR(191) NULL,
    `osName` VARCHAR(191) NULL,
    `osVersion` VARCHAR(191) NULL,
    `browserName` VARCHAR(191) NULL,
    `browserVersion` VARCHAR(191) NULL,
    `uaRaw` VARCHAR(191) NULL,

    INDEX `EmailEvento_reporteId_tipo_fecha_idx`(`reporteId`, `tipo`, `fecha`),
    INDEX `EmailEvento_tipo_fecha_idx`(`tipo`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailRebote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporteId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `codigo` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `raw` VARCHAR(191) NULL,

    INDEX `EmailRebote_reporteId_fecha_idx`(`reporteId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ReporteEmail_trackingTok_key` ON `ReporteEmail`(`trackingTok`);

-- AddForeignKey
ALTER TABLE `ContactoEmail` ADD CONSTRAINT `ContactoEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_contactoId_fkey` FOREIGN KEY (`contactoId`) REFERENCES `ContactoEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailEvento` ADD CONSTRAINT `EmailEvento_reporteId_fkey` FOREIGN KEY (`reporteId`) REFERENCES `ReporteEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailRebote` ADD CONSTRAINT `EmailRebote_reporteId_fkey` FOREIGN KEY (`reporteId`) REFERENCES `ReporteEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `reporteemail` RENAME INDEX `ReporteEmail_campañaId_fkey` TO `ReporteEmail_campañaId_idx`;

-- RenameIndex
ALTER TABLE `reporteemail` RENAME INDEX `ReporteEmail_contactoId_fkey` TO `ReporteEmail_contactoId_idx`;
