-- CreateTable
CREATE TABLE `EmailDesuscripciones` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailHash` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `campaignId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailDesuscripciones_tenantId_emailHash_idx`(`tenantId`, `emailHash`),
    UNIQUE INDEX `EmailDesuscripciones_tenantId_emailHash_scope_campaignId_key`(`tenantId`, `emailHash`, `scope`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
