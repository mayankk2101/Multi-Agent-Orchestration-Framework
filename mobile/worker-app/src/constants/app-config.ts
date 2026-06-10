import type { UserRole } from '@/types/api';

export const APP_NAME = 'Worker Portal';
export const ALLOWED_ROLES: readonly UserRole[] = ['worker', 'manager', 'admin'];
