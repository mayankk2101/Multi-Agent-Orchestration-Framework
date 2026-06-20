"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationsApi, ApiError } from "@/lib/api";
import { NotificationTypeBadge } from "@/components/notifications/NotificationTypeBadge";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui";
import type { Notification } from "@/lib/types";

const READ_FILTERS: Array<{ value: "" | "unread" | "read"; label: string }> = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, error, mutate } =
    useNotifications();

  const [filter, setFilter] = useState<"" | "unread" | "read">("");
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible: Notification[] = notifications.filter((n) =>
    filter === "" ? true : filter === "unread" ? !n.is_read : n.is_read,
  );

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    setActionError(null);
    setMarkingAll(true);
    try {
      await Promise.all(unread.map((n) => notificationsApi.markAsRead(n.id)));
      await mutate();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to mark all as read. Please try again.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
              : "You're all caught up."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          loading={markingAll}
          disabled={unreadCount === 0}
          className="shrink-0"
        >
          Mark all as read
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="read">
          Show
        </label>
        <select
          id="read"
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as "" | "unread" | "read")
          }
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {READ_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="px-6 py-10 text-center text-sm text-red-600">
              Failed to load notifications. Please try again.
            </div>
          ) : isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No notifications found.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Title</TH>
                  <TH>Type</TH>
                  <TH>Received</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((n) => (
                  <TR key={n.id} className="cursor-pointer">
                    <TD className="font-medium">
                      <Link
                        href={`/notifications/${n.id}`}
                        className="block text-blue-700 hover:underline"
                      >
                        {n.title}
                      </Link>
                    </TD>
                    <TD>
                      <NotificationTypeBadge type={n.type} />
                    </TD>
                    <TD>{formatTime(n.created_at)}</TD>
                    <TD>
                      {n.is_read ? (
                        <Badge tone="neutral">Read</Badge>
                      ) : (
                        <Badge tone="info">Unread</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
