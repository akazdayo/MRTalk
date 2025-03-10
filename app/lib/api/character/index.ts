import { Character } from "@prisma/client";
import { prisma } from "~/lib/db/db";

export const getCharacter = async (id: string, isIncludePostedBy: boolean) => {
  return await prisma.character.findUnique({
    where: { id },
    include: { user: isIncludePostedBy },
  });
};

export const getCharacters = async (isIncludePostedBy: boolean) => {
  return await prisma.character.findMany({
    include: { user: isIncludePostedBy },
  });
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
    throw new Error("Character not found.");
  }

  if (existingCharacter.postedBy !== user) {
    throw new Error(
      "The requesting user does not have permission to edit the character."
    );
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
    throw new Error("Character not found.");
  }

  if (existingCharacter.postedBy !== user) {
    throw new Error(
      "The requesting user does not have permission to edit the character."
    );
  }

  await prisma.character.delete({ where: { id } });
};
