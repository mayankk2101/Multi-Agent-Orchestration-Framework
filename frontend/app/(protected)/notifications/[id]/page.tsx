"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNotification } from "@/hooks/useNotifications";
import { notificationsApi, ApiError } from "@/lib/api";
import {
  NotificationTypeBadge,
  notificationTypeLabel,
} from "@/components/notifications/NotificationTypeBadge";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const { notification, isLoading, error, mutate } = useNotification(id);

  const [actionError, setActionError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const markRead = async () => {
    setActionError(null);
    setMarking(true);
    try {
      await notificationsApi.markAsRead(id);
      await mutate();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to mark as read. Please try again.",
      );
    } finally {
      setMarking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="space-y-4">
        <Link
          href="/notifications"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to notifications
        </Link>
        <Card>
          <CardContent className="text-sm text-red-600">
            This notification was not found or could not be loaded.
          </CardContent>
        </Card>
      </div>
    );
  }

  // `data` carries arbitrary resource ids for deep-linking; render any present.
  const dataEntries = notification.data
    ? Object.entries(notification.data)
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/notifications"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to notifications
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">
            {notification.title}
          </h1>
          <div className="flex items-center gap-2">
            <NotificationTypeBadge type={notification.type} />
            {notification.is_read ? (
              <Badge tone="neutral">Read</Badge>
            ) : (
              <Badge tone="info">Unread</Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-gray-900">
            {notification.message}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow
            label="Type"
            value={notificationTypeLabel(notification.type)}
          />
          <DetailRow label="Channel" value={notification.channel} />
          <DetailRow
            label="Received"
            value={formatTime(notification.created_at)}
          />
          <DetailRow label="Read at" value={formatTime(notification.read_at)} />
          {dataEntries.map(([key, value]) => (
            <DetailRow key={key} label={key} value={String(value)} />
          ))}
        </CardContent>
      </Card>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {!notification.is_read && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Mark this notification as read once you&apos;ve seen it.
            </div>
            <Button onClick={markRead} loading={marking} className="shrink-0">
              Mark as read
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
