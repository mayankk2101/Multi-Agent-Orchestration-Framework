"use client";

import { useState } from "react";
import Link from "next/link";
import { useAttendance } from "@/hooks/useAttendance";
import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { VerificationBadge } from "@/components/attendance/VerificationBadge";
import {
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
import type { AttendanceStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: AttendanceStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "EXPECTED", label: "Expected" },
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "PARTIAL", label: "Partial" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

const VERIFIED_FILTERS: Array<{ value: "" | "true" | "false"; label: string }> = [
  { value: "", label: "Any" },
  { value: "true", label: "Verified" },
  { value: "false", label: "Unverified" },
];

const PER_PAGE = 20;

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AttendancePage() {
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [verified, setVerified] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const { records, isLoading, error, hasNext } = useAttendance({
    status: status || undefined,
    is_verified: verified === "" ? undefined : verified === "true",
    page,
    per_page: PER_PAGE,
  });

  const onStatusChange = (next: AttendanceStatus | "") => {
    setStatus(next);
    setPage(1);
  };

  const onVerifiedChange = (next: "" | "true" | "false") => {
    setVerified(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500">
          Check-in, check-out and verification status for staffed shifts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) =>
            onStatusChange(e.target.value as AttendanceStatus | "")
          }
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium text-gray-700" htmlFor="verified">
          Verification
        </label>
        <select
          id="verified"
          value={verified}
          onChange={(e) =>
            onVerifiedChange(e.target.value as "" | "true" | "false")
          }
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VERIFIED_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="px-6 py-10 text-center text-sm text-red-600">
              Failed to load attendance. Please try again.
            </div>
          ) : isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : records.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No attendance records found.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Worker</TH>
                  <TH>Status</TH>
                  <TH>Check-in</TH>
                  <TH>Check-out</TH>
                  <TH>Verification</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((r) => (
                  <TR key={r.id} className="cursor-pointer">
                    <TD className="font-medium">
                      <Link
                        href={`/attendance/${r.id}`}
                        className="block text-blue-700 hover:underline"
                      >
                        {r.worker_id}
                      </Link>
                    </TD>
                    <TD>
                      <AttendanceStatusBadge status={r.status} />
                    </TD>
                    <TD>{formatTime(r.check_in_at)}</TD>
                    <TD>{formatTime(r.check_out_at)}</TD>
                    <TD>
                      <VerificationBadge verified={r.is_verified} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext || isLoading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
