"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAssignment } from "@/hooks/useAssignments";
import { assignmentsApi, ApiError } from "@/lib/api";
import { AssignmentStatusBadge } from "@/components/assignments/AssignmentStatusBadge";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
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

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const { data: assignment, isLoading, error, mutate } = useAssignment(id);

  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const busy = starting || completing || cancelling;

  const start = async () => {
    setActionError(null);
    setStarting(true);
    try {
      const updated = await assignmentsApi.start(id);
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to start assignment. Please try again.",
      );
    } finally {
      setStarting(false);
    }
  };

  const complete = async () => {
    setActionError(null);
    setCompleting(true);
    try {
      const updated = await assignmentsApi.complete(id);
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to complete assignment. Please try again.",
      );
    } finally {
      setCompleting(false);
    }
  };

  const cancel = async () => {
    setActionError(null);
    setCancelling(true);
    try {
      const updated = await assignmentsApi.cancel(
        id,
        cancelReason.trim() || undefined,
      );
      await mutate(updated, { revalidate: false });
      setCancelOpen(false);
      setCancelReason("");
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to cancel assignment. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-4">
        <Link
          href="/assignments"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to assignments
        </Link>
        <Card>
          <CardContent className="text-sm text-red-600">
            {error instanceof ApiError && error.status === 404
              ? "This assignment was not found."
              : "This assignment was not found or could not be loaded."}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Backend transition table: CONFIRMED → IN_PROGRESS/CANCELLED,
  // IN_PROGRESS → COMPLETED/CANCELLED. Other states are terminal here.
  const canStart = assignment.status === "CONFIRMED";
  const canComplete = assignment.status === "IN_PROGRESS";
  const canCancel =
    assignment.status === "CONFIRMED" || assignment.status === "IN_PROGRESS";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/assignments"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to assignments
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Assignment</h1>
          <AssignmentStatusBadge status={assignment.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow label="Worker" value={assignment.worker_id} />
          <DetailRow
            label="Work request"
            value={
              <Link
                href={`/requests/${assignment.work_request_id}`}
                className="text-blue-700 hover:underline"
              >
                {assignment.work_request_id}
              </Link>
            }
          />
          <DetailRow label="Hotel" value={assignment.hotel_id} />
          <DetailRow label="Assigned by" value={assignment.assigned_by_id} />
          <DetailRow
            label="Confirmed"
            value={new Date(assignment.confirmed_at).toLocaleString()}
          />
          {assignment.started_at && (
            <DetailRow
              label="Started"
              value={new Date(assignment.started_at).toLocaleString()}
            />
          )}
          {assignment.completed_at && (
            <DetailRow
              label="Completed"
              value={new Date(assignment.completed_at).toLocaleString()}
            />
          )}
          {assignment.cancelled_at && (
            <DetailRow
              label="Cancelled"
              value={new Date(assignment.cancelled_at).toLocaleString()}
            />
          )}
          {assignment.cancellation_reason && (
            <DetailRow
              label="Cancellation reason"
              value={assignment.cancellation_reason}
            />
          )}
        </CardContent>
      </Card>

      {(canStart || canComplete || canCancel) && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Manage this assignment&apos;s status. Transitions follow the
              shift lifecycle.
            </div>
            <div className="flex shrink-0 gap-2">
              {canCancel && (
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              )}
              {canStart && (
                <Button onClick={start} loading={starting} disabled={cancelling}>
                  Start shift
                </Button>
              )}
              {canComplete && (
                <Button
                  onClick={complete}
                  loading={completing}
                  disabled={cancelling}
                >
                  Complete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Modal
        open={cancelOpen}
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        title="Cancel assignment"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep assignment
            </Button>
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              Cancel assignment
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="cancellation-reason"
            className="text-sm font-medium text-gray-700"
          >
            Reason (optional)
          </label>
          <textarea
            id="cancellation-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Share why this assignment was cancelled."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Modal>
    </div>
  );
}
