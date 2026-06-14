import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';

export const CheckInSchema = z.object({
  assignment_id: z.string(),
  notes: z.string().max(1000).optional(),
});

export const UpdateAttendanceSchema = z
  .object({
    check_out_at: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
    // Manager-only verification fields
    status: z
      .enum(['PRESENT', 'ABSENT', 'LATE', 'PARTIAL', 'EXCUSED'])
      .optional(),
    minutes_late: z.number().int().min(0).optional(),
    minutes_worked: z.number().int().min(0).optional(),
    is_verified: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const ListAttendanceQuerySchema = z.object({
  hotel_id: z.string().optional(),
  worker_id: z.string().optional(),
  assignment_id: z.string().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  is_verified: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;
export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof ListAttendanceQuerySchema>;

export interface AttendanceDto {
  id: string;
  assignment_id: string;
  worker_id: string;
  hotel_id: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  expected_start: string | null;
  expected_end: string | null;
  minutes_late: number | null;
  minutes_worked: number | null;
  notes: string | null;
  is_verified: boolean;
  verified_by_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}
