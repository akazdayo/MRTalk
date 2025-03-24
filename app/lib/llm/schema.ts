import { z } from "zod";

export const InputSchema = z.object({
  id: z.string().min(1, "id is required"),
  text: z.string().min(1, "text is required"),
});

export const EmotionSchema = z.object({
  joy: z.number().min(0).max(1),
  fun: z.number().min(0).max(1),
  sorrow: z.number().min(0).max(1),
  angry: z.number().min(0).max(1),
});

export const ResponseSchema = z.object({
  role: z.string(),
  content: z.string(),
  emotion: EmotionSchema,
});
