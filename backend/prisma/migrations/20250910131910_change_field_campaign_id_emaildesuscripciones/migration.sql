/*
  Warnings:

  - Made the column `campaignId` on table `emaildesuscripciones` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `emaildesuscripciones` MODIFY `campaignId` VARCHAR(191) NOT NULL DEFAULT '';
