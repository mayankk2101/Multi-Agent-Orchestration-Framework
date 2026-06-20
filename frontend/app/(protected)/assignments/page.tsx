"use client";

import { useState } from "react";
import Link from "next/link";
import { useAssignments } from "@/hooks/useAssignments";
import { AssignmentStatusBadge } from "@/components/assignments/AssignmentStatusBadge";
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
import type { AssignmentStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: AssignmentStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NO_SHOW", label: "No show" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REASSIGNED", label: "Reassigned" },
];

const PER_PAGE = 20;

export default function AssignmentsPage() {
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [page, setPage] = useState(1);

  const { assignments, isLoading, error, hasNext } = useAssignments({
    status: status || undefined,
    page,
    per_page: PER_PAGE,
  });

  // Reset to the first page whenever the status filter changes.
  const onStatusChange = (next: AssignmentStatus | "") => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Assignments</h1>
        <p className="text-sm text-gray-500">
          Confirmed workers and the shifts they are staffed on.
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
            onStatusChange(e.target.value as AssignmentStatus | "")
          }
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((f) => (
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
              Failed to load assignments. Please try again.
            </div>
          ) : isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : assignments.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No assignments found.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Worker</TH>
                  <TH>Work request</TH>
                  <TH>Confirmed</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {assignments.map((a) => (
                  <TR key={a.id} className="cursor-pointer">
                    <TD className="font-medium">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="block text-blue-700 hover:underline"
                      >
                        {a.worker_id}
                      </Link>
                    </TD>
                    <TD>
                      <Link
                        href={`/requests/${a.work_request_id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {a.work_request_id}
                      </Link>
                    </TD>
                    <TD>{new Date(a.confirmed_at).toLocaleDateString()}</TD>
                    <TD>
                      <AssignmentStatusBadge status={a.status} />
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
