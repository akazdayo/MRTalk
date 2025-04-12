import { prisma } from "~/lib/db/db";

export const resetMemory = async (id: string) => {
  return await prisma.store.deleteMany({ where: { prefix: id } });
};
