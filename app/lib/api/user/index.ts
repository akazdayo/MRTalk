import { prisma } from "~/lib/db/db";

export const getUserProfile = async (userId: string) => {
  return await prisma.user.findUnique({ where: { id: userId } });
};
