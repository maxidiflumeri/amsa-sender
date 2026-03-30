-- Migration: add_respuestas_rapidas
-- Crear tabla WaApiRespuestaRapida
-- Ejecutar manualmente en MySQL si Prisma migrate no funciona por drift

CREATE TABLE IF NOT EXISTS `WaApiRespuestaRapida` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(191) NOT NULL,
  `contenido` TEXT NOT NULL,
  `tags` JSON NOT NULL DEFAULT ('[]'),
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WaApiRespuestaRapida_activo_idx` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
