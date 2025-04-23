import { z } from "zod";

export const CreateCharacterSchema = z
  .object({
    name: z
      .string({ required_error: "Name is Required" })
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    personality: z
      .string({ required_error: "Personality is Required" })
      .min(1, "Personality is required"),
    story: z.string().min(1, "Story is required"),
    model: z.custom<File>().refine((file) => {
      if (!file) return false;
      return file.name.endsWith(".vrm");
    }, "Invalid file type. Only .vrm files are allowed"),
    voice: z.custom<File>().refine((file) => {
      if (!file) return false;
      return file.name.endsWith(".wav");
    }, "Invalid file type. Only .wav files are allowed"),
    transcript: z
      .string({ required_error: "Transcript is Required" })
      .min(1, "Transcript is required"),
  })
  .strict();

export const UpdateCharacterSchema = z
  .object({
    id: z
      .string({ required_error: "Character ID is Required" })
      .uuid()
      .min(1, "Character ID is required"),
    name: z
      .string({ required_error: "Name is Required" })
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    personality: z
      .string({ required_error: "Personality is Required" })
      .min(1, "Personality is required"),
    story: z
      .string({ required_error: "Story is Required" })
      .min(1, "Story is required"),
  })
  .strict();
