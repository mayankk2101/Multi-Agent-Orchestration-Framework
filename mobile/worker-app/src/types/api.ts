export type UserRole = 'worker' | 'checker' | 'manager' | 'admin';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: { code: string; message: string };
  meta: { timestamp: string; request_id: string };
}
