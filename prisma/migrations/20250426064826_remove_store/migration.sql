/*
  Warnings:

  - You are about to drop the `store` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_migrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_vectors` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vector_migrations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "store_vectors" DROP CONSTRAINT "store_vectors_prefix_key_fkey";

-- DropTable
DROP TABLE "store";

-- DropTable
DROP TABLE "store_migrations";

-- DropTable
DROP TABLE "store_vectors";

-- DropTable
DROP TABLE "vector_migrations";
