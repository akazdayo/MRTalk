/*
  Warnings:

  - Added the required column `model_url` to the `character` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "character" ADD COLUMN     "model_url" TEXT NOT NULL;
