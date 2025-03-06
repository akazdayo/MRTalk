import { Character } from "@prisma/client";
import { prisma } from "~/lib/db/db";

export const getCharacter = async (id: string) => {
  return await prisma.character.findUnique({ where: { id } });
};

export const getCharacters = async () => {
  return await prisma.character.findMany();
};

export const createCharacter = async (character: Omit<Character, "id">) => {
  return await prisma.character.create({ data: character });
};

export const updateCharacter = async (
  character: Omit<Character, "postedBy">,
  user: string
) => {
  const existingCharacter = await prisma.character.findUnique({
    where: { id: character.id },
  });

  if (!existingCharacter) {
    throw new Error("Character not found");
  }

  if (existingCharacter.postedBy !== user) {
    throw new Error("Unauthorized");
  }

  return await prisma.character.update({
    where: { id: character.id },
    data: {
      name: character.name,
      personality: character.personality,
      story: character.story,
      model_url: character.model_url,
    },
  });
};

export const deleteCharacter = async (id: string, user: string) => {
  const existingCharacter = await prisma.character.findUnique({
    where: { id },
  });

  if (!existingCharacter) {
    throw new Error("Character not found");
  }

  if (existingCharacter.postedBy !== user) {
    throw new Error("Unauthorized");
  }

  await prisma.character.delete({ where: { id } });
};
