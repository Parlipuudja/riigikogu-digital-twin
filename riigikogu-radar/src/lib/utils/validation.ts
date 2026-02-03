import { z } from "zod";

/**
 * Common validation schemas for API requests
 */

export const PredictRequestSchema = z.object({
  billTitle: z.string().min(1, "Bill title is required").max(500),
  billDescription: z.string().max(5000).optional(),
  billFullText: z.string().max(100000).optional(),
});

export const SimulateRequestSchema = PredictRequestSchema.extend({
  draftUuid: z.string().uuid().optional(),
});

export type PredictRequest = z.infer<typeof PredictRequestSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
