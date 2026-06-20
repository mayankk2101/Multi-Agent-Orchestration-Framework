import { Badge } from "@/components/ui";
import type { ApplicationStatus } from "@/lib/types";

/** Maps each application status to a Badge tone + human label. */
const STATUS: Record<
  ApplicationStatus,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  PENDING: { tone: "warning", label: "Pending" },
  ACCEPTED: { tone: "success", label: "Accepted" },
  REJECTED: { tone: "danger", label: "Rejected" },
  WITHDRAWN: { tone: "neutral", label: "Withdrawn" },
  EXPIRED: { tone: "neutral", label: "Expired" },
};

export function ApplicationStatusBadge({
  status,
}: {
  status: ApplicationStatus;
}) {
  const { tone, label } = STATUS[status] ?? STATUS.PENDING;
  return <Badge tone={tone}>{label}</Badge>;
}
