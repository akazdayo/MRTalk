import { Character } from "@prisma/client";
import { Session, User } from "better-auth";
import { prisma } from "~/lib/db/db";

export const getCharacter = async (
  characterId: string,
  session: { user: User; session: Session } | null,
  isIncludePostedBy: boolean
) => {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { user: isIncludePostedBy },
  });

  if (!character) return null;

  //非ログイン時
  if (!session) {
    //publicなキャラクターであれば返す
    if (character.is_public === true) {
      return character;
    } else {
      return null;
    }
    //ログイン時
  } else {
    //キャラクターがpublicか自分の投稿したものであれば返す
    if (
      character.is_public === true ||
      character.postedBy === session.user.id
    ) {
      return character;
    } else {
      return null;
    }
  }
};

export const getAllCharacters = async (isIncludePostedBy: boolean) => {
  //publicなものだけ取得
  return await prisma.character.findMany({
    where: { is_public: true },
    include: { user: isIncludePostedBy },
    orderBy: { updatedAt: "desc" },
  });
};

export const getAllCharactersByUser = async (
  userId: string,
  session: { user: User; session: Session } | null,
  isIncludePostedBy: boolean
) => {
  const data = await prisma.character.findMany({
    include: { user: isIncludePostedBy },
    where: { postedBy: userId },
    orderBy: { updatedAt: "desc" },
  });

  //publicなもの
  const publicCharacters = data.filter((c) => {
    return c.is_public === true;
  });

  //非ログイン時
  if (!session) {
    //publicだけ返す
    return publicCharacters;
  } else {
    //自分のモデルリストであればすべて返す
    if (userId === session.user.id) {
      return data;
    } else {
      return publicCharacters;
    }
  }
};

export const createCharacter = async (
  character: Omit<Character, "createdAt" | "updatedAt">
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
      is_public: character.is_public,
    },
  });
};

export const deleteCharacter = async (id: string) => {
  await prisma.character.delete({ where: { id } });
};

export const checkPermission = async (
  characterId: string,
  session: { user: User; session: Session }
) => {
  const existingCharacter = await prisma.character.findUnique({
    where: { id: characterId },
  });

  if (!existingCharacter) {
    return false;
  }

  if (existingCharacter.postedBy !== session.user.id) {
    return false;
  } else {
    return true;
  }
};
