import { z } from 'zod';

export const CreateQualityVerificationSchema = z.object({
  assignment_id: z.string().min(1),
  score: z.number().int().min(0).max(100),
  notes: z.string().optional(),
});

export interface CreateQualityVerificationRequest {
  assignment_id: string;
  score: number; // 0-100
  notes?: string;
}

export const CreateRatingSchema = z.object({
  assignment_id: z.string().min(1),
  worker_id: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  criteria_scores: z.record(z.string(), z.number()).optional(),
});

export interface CreateRatingRequest {
  assignment_id: string;
  worker_id: string;
  score: number; // 1-5
  comment?: string;
  criteria_scores?: Record<string, number>;
}
