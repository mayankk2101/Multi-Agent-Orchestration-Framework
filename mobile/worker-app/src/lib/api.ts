import type {
  User,
  AuthResponse,
  WorkRequest,
  WorkApplication,
  WorkerAssignment,
  Attendance,
  Notification,
  LeaderboardEntry,
  DashboardStats,
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
  workRequests: {
    list: (params?: { status?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      return request<WorkRequest[]>(`/work-requests${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<WorkRequest>(`/work-requests/${id}`),
  },
  applications: {
    apply: (workRequestId: string) =>
      request<WorkApplication>(`/work-requests/${workRequestId}/applications`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    withdraw: (workRequestId: string, applicationId: string) =>
      request<WorkApplication>(`/work-requests/${workRequestId}/applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'WITHDRAWN' }),
      }),
  },
  assignments: {
    list: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      return request<WorkerAssignment[]>(`/assignments${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<WorkerAssignment>(`/assignments/${id}`),
    updateStatus: (id: string, status: string) =>
      request<WorkerAssignment>(`/assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  attendance: {
    checkIn: (assignmentId: string) =>
      request<Attendance>('/attendance', {
        method: 'POST',
        body: JSON.stringify({ assignment_id: assignmentId }),
      }),
    checkOut: (attendanceId: string) =>
      request<Attendance>(`/attendance/${attendanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ check_out_time: new Date().toISOString() }),
      }),
    get: (id: string) => request<Attendance>(`/attendance/${id}`),
  },
  notifications: {
    list: () => request<Notification[]>('/notifications'),
    markRead: (notificationId: string) =>
      request<Notification>(`/notifications/${notificationId}/read`, { method: 'POST' }),
  },
  analytics: {
    stats: () => request<DashboardStats>('/analytics/stats'),
    leaderboard: () => request<LeaderboardEntry[]>('/analytics/leaderboard'),
  },
};
