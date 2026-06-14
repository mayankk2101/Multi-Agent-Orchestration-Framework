import type {
  User,
  AuthResponse,
  AttendanceRecord,
  QualityVerification,
  Rating,
  LeaderboardEntry,
  Notification,
} from '@/types/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Request failed',
      res.status,
    );
  }

  return body.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    refresh: (refresh_token: string) =>
      request<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<User>('/auth/me'),
  },

  attendance: {
    list: (params?: {
      is_verified?: boolean;
      status?: string;
      hotel_id?: string;
      page?: number;
      per_page?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.is_verified !== undefined) qs.set('is_verified', String(params.is_verified));
      if (params?.status) qs.set('status', params.status);
      if (params?.hotel_id) qs.set('hotel_id', params.hotel_id);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.per_page) qs.set('per_page', String(params.per_page));
      return request<{ data: AttendanceRecord[]; total: number }>(`/attendance?${qs}`);
    },
    get: (id: string) => request<AttendanceRecord>(`/attendance/${id}`),
    verify: (id: string, notes?: string) =>
      request<AttendanceRecord>(`/attendance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_verified: true, ...(notes ? { notes } : {}) }),
      }),
  },

  quality: {
    createVerification: (data: {
      assignment_id: string;
      score: number;
      notes?: string;
      status?: string;
    }) =>
      request<QualityVerification>('/quality/verifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createRating: (data: {
      assignment_id: string;
      worker_id: string;
      score: number;
      comment?: string;
    }) =>
      request<Rating>('/quality/ratings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    leaderboard: (hotel_id?: string) =>
      request<LeaderboardEntry[]>(
        hotel_id ? `/quality/leaderboard/by-hotel/${hotel_id}` : '/quality/leaderboard'
      ),
  },

  notifications: {
    list: () => request<Notification[]>('/notifications'),
    markAsRead: (id: string) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  },
};
