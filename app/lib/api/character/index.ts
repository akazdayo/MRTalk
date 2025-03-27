import { Character } from "@prisma/client";
import { prisma } from "~/lib/db/db";

export const getCharacter = async (id: string, isIncludePostedBy: boolean) => {
  return await prisma.character.findUnique({
    where: { id },
    include: { user: isIncludePostedBy },
  });
};

export const getAllCharacters = async (isIncludePostedBy: boolean) => {
  return await prisma.character.findMany({
    include: { user: isIncludePostedBy },
    orderBy: { updatedAt: "desc" },
  });
};

export const getAllCharactersByUser = async (
  id: string,
  isIncludePostedBy: boolean
) => {
  return await prisma.character.findMany({
    include: { user: isIncludePostedBy },
    where: { postedBy: id },
    orderBy: { updatedAt: "desc" },
  });
};

export const createCharacter = async (
  character: Omit<Character, "id" | "createdAt" | "updatedAt">
) => {
  return await prisma.character.create({ data: character });
};

export const updateCharacter = async (
  character: Omit<
    Character,
    "postedBy" | "createdAt" | "updatedAt" | "model_url"
  >
) => {
  return await prisma.character.update({
    where: { id: character.id },
    data: {
      name: character.name,
      personality: character.personality,
      story: character.story,
    },
  });
};

export const deleteCharacter = async (id: string) => {
  await prisma.character.delete({ where: { id } });
};

export const checkPermission = async (characterId: string, userId: string) => {
  const existingCharacter = await prisma.character.findUnique({
    where: { id: characterId },
  });

  if (!existingCharacter) {
    return false;
  }

  if (existingCharacter.postedBy !== userId) {
    return false;
  } else {
    return true;
  }
};
