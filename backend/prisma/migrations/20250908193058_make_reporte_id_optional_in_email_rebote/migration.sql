-- DropForeignKey
ALTER TABLE `emailrebote` DROP FOREIGN KEY `EmailRebote_reporteId_fkey`;

-- AlterTable
ALTER TABLE `emailrebote` MODIFY `reporteId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `EmailRebote` ADD CONSTRAINT `EmailRebote_reporteId_fkey` FOREIGN KEY (`reporteId`) REFERENCES `ReporteEmail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
