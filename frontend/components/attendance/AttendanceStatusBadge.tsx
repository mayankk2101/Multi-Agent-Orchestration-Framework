import { Badge } from "@/components/ui";
import type { AttendanceStatus } from "@/lib/types";

/** Maps each attendance status to a Badge tone + human label. */
const STATUS: Record<
  AttendanceStatus,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  EXPECTED: { tone: "neutral", label: "Expected" },
  PRESENT: { tone: "success", label: "Present" },
  ABSENT: { tone: "danger", label: "Absent" },
  LATE: { tone: "warning", label: "Late" },
  PARTIAL: { tone: "warning", label: "Partial" },
  EXCUSED: { tone: "info", label: "Excused" },
};

export function AttendanceStatusBadge({
  status,
}: {
  status: AttendanceStatus;
}) {
  const { tone, label } = STATUS[status] ?? STATUS.EXPECTED;
  return <Badge tone={tone}>{label}</Badge>;
}
