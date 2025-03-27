import { z } from "zod";

export const InputSchema = z
  .object({
    id: z.string({ required_error: "ID is required" }).min(1, "ID is required"),
    text: z
      .string({ required_error: "Text is required" })
      .min(1, "Text is required"),
  })
  .strict();

export const EmotionSchema = z
  .object({
    neutral: z
      .number({
        required_error: "Neutral score is required",
      })
      .min(0, "Joy value must be 0 or greater")
      .max(1, "Joy value must be 1 or less"),
    happy: z
      .number({
        required_error: "Happy score is required",
      })
      .min(0, "Fun value must be 0 or greater")
      .max(1, "Fun value must be 1 or less"),
    sad: z
      .number({
        required_error: "Sad score is required",
      })
      .min(0, "Sorrow value must be 0 or greater")
      .max(1, "Sorrow value must be 1 or less"),
    angry: z
      .number({
        required_error: "Angry score is required",
      })
      .min(0, "Angry value must be 0 or greater")
      .max(1, "Angry value must be 1 or less"),
  })
  .strict();

export const ResponseSchema = z
  .object({
    role: z
      .string({ required_error: "Role is required" })
      .min(1, "Role is required"),
    content: z
      .string({ required_error: "Content is required" })
      .min(1, "Content is required"),
    emotion: EmotionSchema,
    event: z.union([
      z.literal("sit"),
      z.literal("go_to_user_position"),
      z.null(),
    ]),
    voice: z
      .string({ required_error: "Voice is required" })
      .base64()
      .min(1, "Voice is required"),
  })
  .strict();
