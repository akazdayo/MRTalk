/*
  Warnings:

  - A unique constraint covering the columns `[characterId]` on the table `voice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "voice_characterId_key" ON "voice"("characterId");
