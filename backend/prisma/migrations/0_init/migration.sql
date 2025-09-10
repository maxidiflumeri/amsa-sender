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

-- CreateTable
CREATE TABLE `Mensaje` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `campañaId` INTEGER NULL,
    `ani` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `fromMe` BOOLEAN NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `tipo` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CuentaSMTP` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `puerto` INTEGER NOT NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `remitente` VARCHAR(191) NOT NULL,
    `emailFrom` VARCHAR(191) NOT NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `foto` VARCHAR(191) NULL,
    `rol` VARCHAR(191) NOT NULL DEFAULT 'usuario',
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplateEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `asunto` VARCHAR(191) NOT NULL,
    `html` MEDIUMTEXT NOT NULL,
    `design` JSON NOT NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampañaEmail` (
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
    `config` JSON NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactoEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `datos` JSON NULL,
    `campañaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReporteEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campañaId` INTEGER NOT NULL,
    `contactoId` INTEGER NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `enviadoAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,
    `asunto` VARCHAR(191) NULL,
    `html` MEDIUMTEXT NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `trackingTok` VARCHAR(191) NULL,
    `primeroAbiertoAt` DATETIME(3) NULL,
    `primeroClickAt` DATETIME(3) NULL,
    `smtpMessageId` VARCHAR(255) NULL,

    UNIQUE INDEX `ReporteEmail_trackingTok_key`(`trackingTok`),
    UNIQUE INDEX `ReporteEmail_smtpMessageId_key`(`smtpMessageId`),
    INDEX `ReporteEmail_campañaId_idx`(`campañaId`),
    INDEX `ReporteEmail_contactoId_idx`(`contactoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `clave` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Configuracion_userId_scope_clave_key`(`userId`, `scope`, `clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `reporteId` INTEGER NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `codigo` VARCHAR(32) NULL,
    `descripcion` TEXT NULL,
    `raw` MEDIUMTEXT NULL,
    `correo` VARCHAR(320) NULL,
    `smtpMessageId` VARCHAR(255) NULL,
    `xAmsaSender` VARCHAR(512) NULL,

    INDEX `EmailRebote_reporteId_fecha_idx`(`reporteId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailDesuscripciones` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailHash` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `campaignId` VARCHAR(191) NOT NULL DEFAULT '',
    `reason` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailDesuscripciones_tenantId_emailHash_idx`(`tenantId`, `emailHash`),
    UNIQUE INDEX `EmailDesuscripciones_tenantId_emailHash_scope_campaignId_key`(`tenantId`, `emailHash`, `scope`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Campaña` ADD CONSTRAINT `Campaña_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `Template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contacto` ADD CONSTRAINT `Contacto_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `Campaña`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reporte` ADD CONSTRAINT `Reporte_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `Campaña`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampañaEmail` ADD CONSTRAINT `CampañaEmail_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TemplateEmail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactoEmail` ADD CONSTRAINT `ContactoEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_campañaId_fkey` FOREIGN KEY (`campañaId`) REFERENCES `CampañaEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteEmail` ADD CONSTRAINT `ReporteEmail_contactoId_fkey` FOREIGN KEY (`contactoId`) REFERENCES `ContactoEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailEvento` ADD CONSTRAINT `EmailEvento_reporteId_fkey` FOREIGN KEY (`reporteId`) REFERENCES `ReporteEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailRebote` ADD CONSTRAINT `EmailRebote_reporteId_fkey` FOREIGN KEY (`reporteId`) REFERENCES `ReporteEmail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

