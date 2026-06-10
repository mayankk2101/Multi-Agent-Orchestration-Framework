import { z } from 'zod';

export const CreateHotelSchema = z.object({
  name: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100).default('Germany'),
  address: z.string().min(1).max(500),
  timezone: z.string().default('Europe/Berlin'),
});

export const UpdateHotelSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(500).optional(),
  timezone: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const CreateRoomSchema = z.object({
  number: z.string().min(1).max(20),
  type: z.enum(['single', 'double', 'suite']),
  notes: z.string().optional(),
});

export const UpdateRoomSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  type: z.enum(['single', 'double', 'suite']).optional(),
  status: z.enum(['clean', 'dirty', 'occupied', 'maintenance']).optional(),
  notes: z.string().optional(),
});

export const ListHotelsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  country: z.string().optional(),
});

export const ListRoomsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['clean', 'dirty', 'occupied', 'maintenance']).optional(),
  type: z.enum(['single', 'double', 'suite']).optional(),
});

export type CreateHotelRequest = z.infer<typeof CreateHotelSchema>;
export type UpdateHotelRequest = z.infer<typeof UpdateHotelSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomRequest = z.infer<typeof UpdateRoomSchema>;
export type ListHotelsQuery = z.infer<typeof ListHotelsQuerySchema>;
export type ListRoomsQuery = z.infer<typeof ListRoomsQuerySchema>;
