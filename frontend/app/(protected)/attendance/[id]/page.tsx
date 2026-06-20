"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAttendanceRecord } from "@/hooks/useAttendance";
import { attendanceApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { RoleGate } from "@/components/auth/RoleGate";
import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { VerificationBadge } from "@/components/attendance/VerificationBadge";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
} from "@/components/ui";
import type { AttendanceReviewStatus } from "@/lib/types";

const REVIEW_STATUSES: Array<{ value: AttendanceReviewStatus; label: string }> = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "PARTIAL", label: "Partial" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

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

export default function AttendanceDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const { data: record, isLoading, error, mutate } = useAttendanceRecord(id);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStatus, setReviewStatus] =
    useState<AttendanceReviewStatus>("PRESENT");
  const [markVerified, setMarkVerified] = useState(true);

  const checkOut = async () => {
    setActionError(null);
    setCheckingOut(true);
    try {
      const updated = await attendanceApi.checkOut(id);
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to check out. Please try again.",
      );
    } finally {
      setCheckingOut(false);
    }
  };

  const submitReview = async () => {
    setActionError(null);
    setVerifying(true);
    try {
      const updated = await attendanceApi.update(id, {
        status: reviewStatus,
        ...(markVerified ? { is_verified: true } : {}),
      });
      await mutate(updated, { revalidate: false });
      setReviewOpen(false);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to verify attendance. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Link
          href="/attendance"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to attendance
        </Link>
        <Card>
          <CardContent className="text-sm text-red-600">
            {error instanceof ApiError && error.status === 404
              ? "This attendance record was not found."
              : "This attendance record was not found or could not be loaded."}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Worker self check-out: only the owning worker, once checked in and not out.
  const isOwner = currentUserId != null && currentUserId === record.worker_id;
  const canCheckOut =
    isOwner && record.check_in_at !== null && record.check_out_at === null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/attendance"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to attendance
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Attendance</h1>
          <div className="flex items-center gap-2">
            <AttendanceStatusBadge status={record.status} />
            <VerificationBadge verified={record.is_verified} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check-in / Check-out</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow label="Checked in" value={formatTime(record.check_in_at)} />
          <DetailRow
            label="Checked out"
            value={formatTime(record.check_out_at)}
          />
          <DetailRow
            label="Expected start"
            value={formatTime(record.expected_start)}
          />
          <DetailRow
            label="Expected end"
            value={formatTime(record.expected_end)}
          />
          <DetailRow
            label="Minutes late"
            value={record.minutes_late ?? "—"}
          />
          <DetailRow
            label="Minutes worked"
            value={record.minutes_worked ?? "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <DetailRow label="Worker" value={record.worker_id} />
          <DetailRow
            label="Assignment"
            value={
              <Link
                href={`/assignments/${record.assignment_id}`}
                className="text-blue-700 hover:underline"
              >
                {record.assignment_id}
              </Link>
            }
          />
          <DetailRow label="Hotel" value={record.hotel_id} />
          {record.verified_by_id && (
            <DetailRow label="Verified by" value={record.verified_by_id} />
          )}
          {record.verified_at && (
            <DetailRow
              label="Verified at"
              value={formatTime(record.verified_at)}
            />
          )}
          {record.notes && <DetailRow label="Notes" value={record.notes} />}
        </CardContent>
      </Card>

      {canCheckOut && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              You are checked in. Record your check-out to close out this shift.
            </div>
            <Button
              onClick={checkOut}
              loading={checkingOut}
              className="shrink-0"
            >
              Check out
            </Button>
          </CardContent>
        </Card>
      )}

      <RoleGate allow={["manager", "admin", "checker"]}>
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Review this attendance record. Set the final status and mark it
              verified.
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setReviewStatus(
                  record.status === "EXPECTED" ? "PRESENT" : record.status,
                );
                setMarkVerified(!record.is_verified);
                setReviewOpen(true);
              }}
              className="shrink-0"
            >
              {record.is_verified ? "Update review" : "Verify"}
            </Button>
          </CardContent>
        </Card>
      </RoleGate>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Modal
        open={reviewOpen}
        onClose={() => {
          if (!verifying) setReviewOpen(false);
        }}
        title="Review attendance"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setReviewOpen(false)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button onClick={submitReview} loading={verifying}>
              Save review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="review-status"
              className="text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="review-status"
              value={reviewStatus}
              onChange={(e) =>
                setReviewStatus(e.target.value as AttendanceReviewStatus)
              }
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REVIEW_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={markVerified}
              onChange={(e) => setMarkVerified(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Mark as verified
          </label>
        </div>
      </Modal>
    </div>
  );
}
