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
