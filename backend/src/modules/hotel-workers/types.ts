import { z } from 'zod';

export const AssignWorkerSchema = z.object({
  worker_id: z.string().min(1),
});

export const ListHotelWorkersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['worker', 'checker', 'manager']).optional(),
  search: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
});

export type AssignWorkerRequest = z.infer<typeof AssignWorkerSchema>;
export type ListHotelWorkersQuery = z.infer<typeof ListHotelWorkersQuerySchema>;
