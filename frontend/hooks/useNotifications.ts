"use client";

import useSWR from "swr";
import { notificationsApi } from "@/lib/api";
import type { Notification } from "@/lib/types";

/** Stable SWR key for the current user's notification list. */
const NOTIFICATIONS_KEY = "notifications" as const;

/**
 * Lists the current user's notifications via SWR.
 *
 * The backend returns the 50 most recent notifications (newest first) scoped
 * to the authenticated user — there is no pagination or filtering on the
 * endpoint, so the list is fetched whole and derived counts are computed
 * client-side.
 */
export function useNotifications() {
  const swr = useSWR(NOTIFICATIONS_KEY, () => notificationsApi.list());

  const notifications: Notification[] = swr.data ?? [];
  const unreadCount = notifications.reduce(
    (n, item) => (item.is_read ? n : n + 1),
    0,
  );

  return { ...swr, notifications, unreadCount };
}

/**
 * Reads a single notification out of the shared list cache.
 *
 * The backend has no `GET /notifications/:id`, so the detail view reuses the
 * list fetched by {@link useNotifications}; `mutate` revalidates that list.
 */
export function useNotification(id: string | null | undefined) {
  const { notifications, isLoading, error, mutate } = useNotifications();
  const notification = id
    ? (notifications.find((item) => item.id === id) ?? null)
    : null;

  return { notification, isLoading, error, mutate };
}
