"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkRequests } from "@/hooks/useWorkRequests";
import { ManagerAdminGate } from "@/components/auth/RoleGate";
import { WorkRequestStatusBadge } from "@/components/work-requests/StatusBadge";
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
import type { WorkRequestStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: WorkRequestStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "PARTIALLY_FILLED", label: "Partially filled" },
  { value: "FILLED", label: "Filled" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

const PER_PAGE = 20;

export default function WorkRequestsPage() {
  const [status, setStatus] = useState<WorkRequestStatus | "">("");
  const [page, setPage] = useState(1);

  const { requests, isLoading, error, hasNext } = useWorkRequests({
    status: status || undefined,
    page,
    per_page: PER_PAGE,
  });

  // Reset to the first page whenever the status filter changes.
  const onStatusChange = (next: WorkRequestStatus | "") => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Work requests</h1>
          <p className="text-sm text-gray-500">
            Shifts open for staffing across your hotels.
          </p>
        </div>
        <ManagerAdminGate>
          <Link href="/requests/new">
            <Button>New request</Button>
          </Link>
        </ManagerAdminGate>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as WorkRequestStatus | "")}
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
              Failed to load work requests. Please try again.
            </div>
          ) : isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No work requests found.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Position</TH>
                  <TH>Shift date</TH>
                  <TH>Time</TH>
                  <TH>Staffing</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {requests.map((wr) => (
                  <TR key={wr.id} className="cursor-pointer">
                    <TD className="font-medium">
                      <Link
                        href={`/requests/${wr.id}`}
                        className="block text-blue-700 hover:underline"
                      >
                        {wr.position}
                      </Link>
                    </TD>
                    <TD>{wr.shift_date}</TD>
                    <TD>
                      {wr.shift_start_time}–{wr.shift_end_time}
                    </TD>
                    <TD>
                      {wr.workers_confirmed}/{wr.workers_needed}
                    </TD>
                    <TD>
                      <WorkRequestStatusBadge status={wr.status} />
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
