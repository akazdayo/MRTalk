import { z } from "zod";

export const CreateCharacterSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    personality: z.string().min(1, "Personality is required"),
    story: z.string().min(1, "Story is required"),
    model_url: z.string().url("Invalid model URL"),
  })
  .strict();

export const UpdateCharacterSchema = z
  .object({
    id: z.string().min(1, "Character ID is required"),
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    personality: z.string().min(1, "Personality is required"),
    story: z.string().min(1, "Story is required"),
    model_url: z.string().url("Invalid model URL"),
  })
  .strict();

export const DeleteCharacterSchema = z
  .object({
    id: z.string().min(1, "Character ID is required"),
  })
  .strict();
