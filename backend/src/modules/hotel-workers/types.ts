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

export interface HotelWorkerDto {
  id: string;
  hotel_id: string;
  worker_id: string;
  position: string;
  status: string;
  hourly_rate: string | null;
  currency: string;
  notes: string | null;
  invited_at: string;
  joined_at: string | null;
  left_at: string | null;
}
