import { Badge } from "@/components/ui";

/** Shows whether an attendance record has been verified by a manager/checker. */
export function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge tone="success">Verified</Badge>
  ) : (
    <Badge tone="neutral">Unverified</Badge>
  );
}
