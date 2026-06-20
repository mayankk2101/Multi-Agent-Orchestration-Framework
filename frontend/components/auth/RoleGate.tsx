"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";
import type { Role } from "@/lib/types";

export interface RoleGateProps {
  /** Roles permitted to see the children. */
  allow: Role[];
  /** Rendered when the current user's role is not permitted. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 * Note: this is a UX affordance only — the backend remains the
 * authoritative enforcement point for every protected operation.
 */
export function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Convenience gate for management-only UI (manager + admin). */
export function ManagerAdminGate({
  fallback = null,
  children,
}: {
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RoleGate allow={["manager", "admin"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}
