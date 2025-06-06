-- AlterTable
ALTER TABLE `contacto` ADD COLUMN `datos` JSON NULL,
    MODIFY `mensaje` VARCHAR(191) NULL;
