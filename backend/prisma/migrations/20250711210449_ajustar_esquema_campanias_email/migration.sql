/*
  Warnings:

  - You are about to drop the column `asunto` on the `campañaemail` table. All the data in the column will be lost.
  - You are about to drop the column `asunto` on the `contactoemail` table. All the data in the column will be lost.
  - You are about to drop the column `enviado` on the `contactoemail` table. All the data in the column will be lost.
  - You are about to drop the column `enviadoAt` on the `contactoemail` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `contactoemail` table. All the data in the column will be lost.
  - You are about to drop the column `mensaje` on the `contactoemail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `campañaemail` DROP COLUMN `asunto`;

-- AlterTable
ALTER TABLE `contactoemail` DROP COLUMN `asunto`,
    DROP COLUMN `enviado`,
    DROP COLUMN `enviadoAt`,
    DROP COLUMN `error`,
    DROP COLUMN `mensaje`;

-- CreateTable
CREATE TABLE `ReporteEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campañaId` INTEGER NOT NULL,
    `contactoId` INTEGER NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `enviadoAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,
    `asunto` VARCHAR(191) NULL,
    `html` TEXT NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_contactoId_fkey` FOREIGN KEY (`contactoId`) REFERENCES `ContactoEmail`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
