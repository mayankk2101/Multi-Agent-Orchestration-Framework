import type { UserRole } from '@/types/api';

export const APP_NAME = 'Checker Portal';
export const ALLOWED_ROLES: readonly UserRole[] = ['checker', 'manager', 'admin'];
