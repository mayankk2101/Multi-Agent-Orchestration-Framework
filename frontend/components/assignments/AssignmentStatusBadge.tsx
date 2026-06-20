import { Badge } from "@/components/ui";
import type { AssignmentStatus } from "@/lib/types";

/** Maps each assignment status to a Badge tone + human label. */
const STATUS: Record<
  AssignmentStatus,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  CONFIRMED: { tone: "info", label: "Confirmed" },
  IN_PROGRESS: { tone: "warning", label: "In progress" },
  COMPLETED: { tone: "success", label: "Completed" },
  NO_SHOW: { tone: "danger", label: "No show" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
  REASSIGNED: { tone: "neutral", label: "Reassigned" },
};

export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatus;
}) {
  const { tone, label } = STATUS[status] ?? STATUS.CONFIRMED;
  return <Badge tone={tone}>{label}</Badge>;
}
