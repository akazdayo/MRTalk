import { z } from "zod";

export const FavoriteSchema = z.object({
  characterId: z.string().min(1, "Character ID is required"),
});
