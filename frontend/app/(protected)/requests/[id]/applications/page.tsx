"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkApplications } from "@/hooks/useWorkApplications";
import { ApplicationStatusBadge } from "@/components/work-applications/ApplicationStatusBadge";
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
import type { ApplicationStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: ApplicationStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "EXPIRED", label: "Expired" },
];

const PER_PAGE = 20;

export default function WorkRequestApplicationsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [page, setPage] = useState(1);

  const { applications, isLoading, error, hasNext } = useWorkApplications(id, {
    status: status || undefined,
    page,
    per_page: PER_PAGE,
  });

  const onStatusChange = (next: ApplicationStatus | "") => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/requests/${id}`}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to work request
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          Applications
        </h1>
        <p className="text-sm text-gray-500">
          Workers who have applied to this shift.
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
            onStatusChange(e.target.value as ApplicationStatus | "")
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
              Failed to load applications. Please try again.
            </div>
          ) : isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : applications.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No applications found.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Worker</TH>
                  <TH>Rating</TH>
                  <TH>Applied</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {applications.map((app) => (
                  <TR key={app.id} className="cursor-pointer">
                    <TD className="font-medium">
                      <Link
                        href={`/requests/${id}/applications/${app.id}`}
                        className="block text-blue-700 hover:underline"
                      >
                        {app.worker_id}
                      </Link>
                    </TD>
                    <TD>
                      {app.worker_rating_snapshot != null
                        ? app.worker_rating_snapshot.toFixed(1)
                        : "—"}
                    </TD>
                    <TD>{new Date(app.applied_at).toLocaleDateString()}</TD>
                    <TD>
                      <ApplicationStatusBadge status={app.status} />
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
