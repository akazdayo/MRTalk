import { Session, User } from "better-auth";
import { prisma } from "~/lib/db/db";

export const getFavorite = async (userId: string, characterId: string) => {
  return await prisma.favorite.findUnique({
    where: { userId_characterId: { userId, characterId } },
  });
};

export const getUserFavorites = async (
  userId: string,
  session: { user: User; session: Session } | null
) => {
  const data = await prisma.favorite.findMany({
    where: { userId },
    include: { character: { include: { user: true } } },
  });

  const publicFavorites = data.filter((f) => {
    return f.character.isPublic === true;
  });

  if (!session) {
    return publicFavorites;
  } else {
    if (userId === session.user.id) {
      return data;
    }
    {
      return publicFavorites;
    }
  }
};

export const createFavorite = async (userId: string, characterId: string) => {
  return await prisma.favorite.create({
    data: {
      userId,
      characterId,
    },
  });
};

export const deleteFavorite = async (userId: string, characterId: string) => {
  await prisma.favorite.delete({
    where: { userId_characterId: { userId, characterId } },
  });
};
