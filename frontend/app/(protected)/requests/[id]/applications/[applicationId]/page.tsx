"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkApplication } from "@/hooks/useWorkApplications";
import { workApplicationsApi, ApiError } from "@/lib/api";
import { ManagerAdminGate } from "@/components/auth/RoleGate";
import { ApplicationStatusBadge } from "@/components/work-applications/ApplicationStatusBadge";
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

export default function ApplicationReviewPage() {
  const params = useParams<{ id: string; applicationId: string }>();
  const { id, applicationId } = params;

  const { data: application, isLoading, error, mutate } = useWorkApplication(
    id,
    applicationId,
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const accept = async () => {
    setActionError(null);
    setAccepting(true);
    try {
      const updated = await workApplicationsApi.accept(id, applicationId);
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to accept application. Please try again.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const reject = async () => {
    setActionError(null);
    setRejecting(true);
    try {
      const updated = await workApplicationsApi.reject(
        id,
        applicationId,
        rejectReason.trim() || undefined,
      );
      await mutate(updated, { revalidate: false });
      setRejectOpen(false);
      setRejectReason("");
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to reject application. Please try again.",
      );
    } finally {
      setRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <Link
          href={`/requests/${id}/applications`}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to applications
        </Link>
        <Card>
          <CardContent className="text-sm text-red-600">
            {error instanceof ApiError && error.status === 404
              ? "This application was not found."
              : "This application was not found or could not be loaded."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = application.status === "PENDING";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/requests/${id}/applications`}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to applications
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Application review
          </h1>
          <ApplicationStatusBadge status={application.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applicant</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow label="Worker" value={application.worker_id} />
          <DetailRow
            label="Rating at apply time"
            value={
              application.worker_rating_snapshot != null
                ? application.worker_rating_snapshot.toFixed(1)
                : "—"
            }
          />
          <DetailRow
            label="Applied"
            value={new Date(application.applied_at).toLocaleString()}
          />
          {application.reviewed_at && (
            <DetailRow
              label="Reviewed"
              value={new Date(application.reviewed_at).toLocaleString()}
            />
          )}
          {application.rejection_reason && (
            <DetailRow
              label="Rejection reason"
              value={application.rejection_reason}
            />
          )}
        </CardContent>
      </Card>

      {application.cover_note && (
        <Card>
          <CardHeader>
            <CardTitle>Cover note</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
            {application.cover_note}
          </CardContent>
        </Card>
      )}

      <ManagerAdminGate>
        {isPending && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Review this application. Accepting it confirms the worker for a
                slot on this shift.
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={accepting || rejecting}
                >
                  Reject
                </Button>
                <Button onClick={accept} loading={accepting} disabled={rejecting}>
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </ManagerAdminGate>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Modal
        open={rejectOpen}
        onClose={() => {
          if (!rejecting) setRejectOpen(false);
        }}
        title="Reject application"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} loading={rejecting}>
              Reject application
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="rejection-reason"
            className="text-sm font-medium text-gray-700"
          >
            Reason (optional)
          </label>
          <textarea
            id="rejection-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Share why this application was rejected."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Modal>
    </div>
  );
}
