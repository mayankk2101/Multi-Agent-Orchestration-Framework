"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkRequest } from "@/hooks/useWorkRequests";
import { workRequestsApi, ApiError } from "@/lib/api";
import { ManagerAdminGate } from "@/components/auth/RoleGate";
import { WorkRequestStatusBadge } from "@/components/work-requests/StatusBadge";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function WorkRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: request, isLoading, error, mutate } = useWorkRequest(id);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishError(null);
    setPublishing(true);
    try {
      const updated = await workRequestsApi.publish(id);
      // Optimistically replace the cached value with the server response.
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setPublishError(
        err instanceof ApiError
          ? err.message
          : "Failed to publish. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4">
        <Link href="/requests" className="text-sm text-blue-700 hover:underline">
          ← Back to work requests
        </Link>
        <Card>
          <CardContent className="text-sm text-red-600">
            {error instanceof ApiError && error.status === 404
              ? "This work request was not found."
              : "Failed to load this work request."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/requests" className="text-sm text-blue-700 hover:underline">
          ← Back to work requests
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">
            {request.position}
          </h1>
          <WorkRequestStatusBadge status={request.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shift details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow label="Shift date" value={request.shift_date} />
          <DetailRow
            label="Time"
            value={`${request.shift_start_time}–${request.shift_end_time}`}
          />
          <DetailRow
            label="Staffing"
            value={`${request.workers_confirmed}/${request.workers_needed} confirmed`}
          />
          <DetailRow
            label="Hourly rate"
            value={
              request.hourly_rate != null
                ? `${request.hourly_rate} ${request.currency}`
                : "—"
            }
          />
          <DetailRow
            label="Published"
            value={
              request.published_at
                ? new Date(request.published_at).toLocaleString()
                : "Not published"
            }
          />
          {request.expires_at && (
            <DetailRow
              label="Expires"
              value={new Date(request.expires_at).toLocaleString()}
            />
          )}
          {request.cancellation_reason && (
            <DetailRow
              label="Cancellation reason"
              value={request.cancellation_reason}
            />
          )}
        </CardContent>
      </Card>

      {(request.description || request.requirements) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700">
            {request.description && (
              <div>
                <p className="font-medium text-gray-900">Description</p>
                <p className="whitespace-pre-wrap">{request.description}</p>
              </div>
            )}
            {request.requirements && (
              <div>
                <p className="font-medium text-gray-900">Requirements</p>
                <p className="whitespace-pre-wrap">{request.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ManagerAdminGate>
        {request.status !== "DRAFT" && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Review the workers who have applied to this shift.
              </div>
              <Link href={`/requests/${id}/applications`}>
                <Button variant="outline">View applications</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </ManagerAdminGate>

      <ManagerAdminGate>
        {request.status === "DRAFT" && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                This request is a draft. Publish it to open it for staffing.
              </div>
              <Button onClick={publish} loading={publishing}>
                Publish
              </Button>
            </CardContent>
          </Card>
        )}
      </ManagerAdminGate>

      {publishError && <p className="text-sm text-red-600">{publishError}</p>}
    </div>
  );
}
