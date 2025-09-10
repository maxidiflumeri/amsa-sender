/*
  Warnings:

  - A unique constraint covering the columns `[smtpMessageId]` on the table `ReporteEmail` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `emailrebote` ADD COLUMN `correo` VARCHAR(320) NULL,
    ADD COLUMN `smtpMessageId` VARCHAR(255) NULL,
    ADD COLUMN `xAmsaSender` VARCHAR(512) NULL;

-- AlterTable
ALTER TABLE `reporteemail` ADD COLUMN `smtpMessageId` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ReporteEmail_smtpMessageId_key` ON `ReporteEmail`(`smtpMessageId`);
