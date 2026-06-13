import { z } from 'zod';

export const EnrollWorkerSchema = z.object({
  worker_id: z.string().min(1),
  position: z.string().min(1),
  hourly_rate: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
});

export type EnrollWorkerInput = z.infer<typeof EnrollWorkerSchema>;

export const ListWorkersQuerySchema = z.object({
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  position: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(20),
});

export type ListWorkersQuery = z.infer<typeof ListWorkersQuerySchema>;

// Response DTO per API_SPEC_V1_PATCH_V2 §PATCH-05e
export interface HotelWorkerDto {
  id: string;
  hotel_id: string;
  worker_id: string;
  role: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}
