import { defineCollection } from "astro:content";
import { z } from "zod";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    language: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
