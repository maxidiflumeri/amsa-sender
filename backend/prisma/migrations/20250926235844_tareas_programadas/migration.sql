-- CreateTable
CREATE TABLE `TareaProgramada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('REPORTE_EMAIL_DIARIO') NOT NULL,
    `habilitada` BOOLEAN NOT NULL DEFAULT true,
    `expresionCron` VARCHAR(191) NOT NULL,
    `zonaHoraria` VARCHAR(191) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    `configuracion` JSON NOT NULL,
    `destinatarios` JSON NOT NULL,
    `reintentosMax` INTEGER NOT NULL DEFAULT 3,
    `backoffMs` INTEGER NOT NULL DEFAULT 60000,
    `ultimaEjecucion` DATETIME(3) NULL,
    `proximaEjecucion` DATETIME(3) NULL,
    `creadoPorUsuarioId` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EjecucionTarea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tareaId` INTEGER NOT NULL,
    `inicioEn` DATETIME(3) NOT NULL,
    `finEn` DATETIME(3) NULL,
    `estado` ENUM('queued', 'running', 'completed', 'failed', 'retrying') NOT NULL,
    `error` TEXT NULL,
    `adjuntos` JSON NULL,
    `logs` JSON NULL,

    INDEX `EjecucionTarea_tareaId_idx`(`tareaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EjecucionTarea` ADD CONSTRAINT `EjecucionTarea_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `TareaProgramada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
