"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { AuthUser } from "@/lib/types";

/**
 * Primary auth hook: exposes the current session plus login/logout
 * actions. Token storage and refresh are handled in the store and
 * `apiFetch`; this hook is the React-facing surface.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      setSession(data);
      return data.user;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = useAuthStore.getState();
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Best-effort: clear locally even if the server call fails.
    } finally {
      clear();
    }
  }, [clear]);

  return {
    user,
    status,
    isAuthenticated: status === "authenticated",
    login,
    logout,
  };
}

/**
 * Fetches and revalidates `/auth/me` via SWR while authenticated,
 * keeping the cached user in the store in sync with the server.
 */
export function useMe() {
  const status = useAuthStore((s) => s.status);
  const setUser = useAuthStore((s) => s.setUser);

  return useSWR<AuthUser>(
    status === "authenticated" ? "/auth/me" : null,
    () => authApi.me(),
    {
      onSuccess: (data) => setUser(data),
      revalidateOnFocus: false,
    },
  );
}
