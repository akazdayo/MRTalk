/*
  Warnings:

  - Added the required column `is_public` to the `character` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "character" ADD COLUMN     "is_public" BOOLEAN NOT NULL;
