-- AlterTable
ALTER TABLE `templateemail` ADD COLUMN `cuentaSmtpId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `TemplateEmail` ADD CONSTRAINT `TemplateEmail_cuentaSmtpId_fkey` FOREIGN KEY (`cuentaSmtpId`) REFERENCES `CuentaSMTP`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
