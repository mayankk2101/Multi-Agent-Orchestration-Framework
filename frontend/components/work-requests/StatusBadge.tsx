import { Badge } from "@/components/ui";
import type { WorkRequestStatus } from "@/lib/types";

/** Maps each work-request status to a Badge tone + human label. */
const STATUS: Record<
  WorkRequestStatus,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  OPEN: { tone: "info", label: "Open" },
  PARTIALLY_FILLED: { tone: "warning", label: "Partially filled" },
  FILLED: { tone: "success", label: "Filled" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
  EXPIRED: { tone: "neutral", label: "Expired" },
};

export function WorkRequestStatusBadge({
  status,
}: {
  status: WorkRequestStatus;
}) {
  const { tone, label } = STATUS[status] ?? STATUS.DRAFT;
  return <Badge tone={tone}>{label}</Badge>;
}
