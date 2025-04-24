import { z } from "zod";

export const CharacterIdSchema = z
  .object({
    characterId: z
      .string({ required_error: "Character ID is Required" })
      .uuid()
      .min(1, "Character ID is required"),
  })
  .strict();
