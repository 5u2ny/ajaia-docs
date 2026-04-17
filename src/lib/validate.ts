/**
 * Input validation with zod.
 *
 * Why zod? It gives us runtime validation AND TypeScript types from one
 * schema — so we never have to keep types and validation in sync manually.
 */
import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Must be a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const CreateDocumentSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export const RenameDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(200, "Title too long"),
});

export const UpdateContentSchema = z.object({
  contentJson: z.unknown(),
  plainTextPreview: z.string().max(500).default(""),
  title: z.string().trim().min(1).max(200).optional(),
});

export const ShareSchema = z.object({
  email: z.string().email("Must be a valid email").trim().toLowerCase(),
});
