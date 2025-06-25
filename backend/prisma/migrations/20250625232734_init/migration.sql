-- CreateTable
CREATE TABLE `Campaña` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enviadoAt` DATETIME(3) NULL,
    `agendadoAt` DATETIME(3) NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `pausada` BOOLEAN NOT NULL DEFAULT false,
    `templateId` INTEGER NULL,
    `jobId` VARCHAR(191) NULL,
    `archivada` BOOLEAN NOT NULL DEFAULT false,
    `sesiones` VARCHAR(191) NULL,
    `config` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contacto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NULL,
    `datos` JSON NULL,
    `campañaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reporte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `aniEnvio` VARCHAR(191) NULL,
    `enviadoAt` DATETIME(3) NULL,
    `datos` JSON NULL,
    `campañaId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sesion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `ani` VARCHAR(191) NULL,

    UNIQUE INDEX `Sesion_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Template` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `contenido` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Campaña` ADD CONSTRAINT `Campaña_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `Template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contacto` ADD CONSTRAINT `Contacto_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `Campaña`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reporte` ADD CONSTRAINT `Reporte_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `Campaña`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
