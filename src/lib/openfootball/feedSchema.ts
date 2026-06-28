// Zod schema for the OpenFootball worldcup.json feed.
// All fields are optional / nullable by design (the feed is community-maintained
// and schema can vary by year or match type). Any unknown fields are safely ignored.

import { z } from "zod";

const ScoreArray = z.tuple([z.number(), z.number()]);

const ScoreObjectSchema = z
  .object({
    ht: ScoreArray.optional().nullable(),
    ft: ScoreArray.optional().nullable(),
    et: ScoreArray.optional().nullable(),
    p: ScoreArray.optional().nullable(),
  })
  .passthrough() // tolerate unknown keys
  .optional()
  .nullable();

export const FeedMatchSchema = z
  .object({
    // Knockout matches have a stable numeric id; group matches do not
    num: z.number().optional().nullable(),
    round: z.string(),
    date: z.string(), // "YYYY-MM-DD"
    time: z.string().optional().nullable(), // "HH:MM UTC-N" or similar
    team1: z.string(),
    team2: z.string(),
    score: ScoreObjectSchema,
    group: z.string().optional().nullable(),
    ground: z.string().optional().nullable(),
  })
  .passthrough();

export const FeedSchema = z
  .object({
    name: z.string(),
    matches: z.array(FeedMatchSchema),
  })
  .passthrough();

export type FeedMatch = z.infer<typeof FeedMatchSchema>;
export type Feed = z.infer<typeof FeedSchema>;
