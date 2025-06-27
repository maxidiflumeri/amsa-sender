-- CreateTable
CREATE TABLE `Mensaje` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `campañaId` INTEGER NULL,
    `ani` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `fromMe` BOOLEAN NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `tipo` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
