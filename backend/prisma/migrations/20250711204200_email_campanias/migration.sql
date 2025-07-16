-- CreateTable
CREATE TABLE `CampañaEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `asunto` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enviadoAt` DATETIME(3) NULL,
    `agendadoAt` DATETIME(3) NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `pausada` BOOLEAN NOT NULL DEFAULT false,
    `templateId` INTEGER NULL,
    `jobId` VARCHAR(191) NULL,
    `archivada` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactoEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `asunto` VARCHAR(191) NULL,
    `mensaje` VARCHAR(191) NULL,
    `datos` JSON NULL,
    `enviado` BOOLEAN NOT NULL DEFAULT false,
    `enviadoAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,
    `campañaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CampañaEmail` ADD CONSTRAINT `CampañaEmail_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TemplateEmail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactoEmail` ADD CONSTRAINT `ContactoEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
