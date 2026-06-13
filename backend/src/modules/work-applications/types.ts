import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

export const ApplyWorkRequestSchema = z.object({
  cover_note: z.string().max(1000).optional(),
});

export const UpdateApplicationSchema = z
  .object({
    status: z.enum(['ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
    rejection_reason: z.string().max(500).optional(),
    cancellation_reason: z.string().max(500).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const ListApplicationsQuerySchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApplyWorkRequestInput = z.infer<typeof ApplyWorkRequestSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type ListApplicationsQuery = z.infer<typeof ListApplicationsQuerySchema>;

export interface WorkApplicationDto {
  id: string;
  work_request_id: string;
  worker_id: string;
  reviewed_by_id: string | null;
  status: ApplicationStatus;
  cover_note: string | null;
  worker_rating_snapshot: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  applied_at: string;
  updated_at: string;
}
