/*
  Warnings:

  - You are about to drop the column `is_public` on the `character` table. All the data in the column will be lost.
  - You are about to drop the column `model_url` on the `character` table. All the data in the column will be lost.
  - Added the required column `modelUrl` to the `character` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "character" DROP COLUMN "is_public",
DROP COLUMN "model_url",
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modelUrl" TEXT NOT NULL;
