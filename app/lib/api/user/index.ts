import { prisma } from "~/lib/db/db";

export const getUserProfile = async (userId: string) => {
  return await prisma.user.findUnique({ where: { id: userId } });
};

export const updateUserProfile = async (
  userId: string,
  name: string,
  image: string
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { name, image },
  });
};
