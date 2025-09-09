/*
  Warnings:

  - You are about to alter the column `codigo` on the `emailrebote` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.

*/
-- AlterTable
ALTER TABLE `emailrebote` MODIFY `codigo` VARCHAR(32) NULL,
    MODIFY `descripcion` TEXT NULL,
    MODIFY `raw` MEDIUMTEXT NULL;
