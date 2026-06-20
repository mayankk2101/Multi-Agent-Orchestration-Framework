"use client";

import { useAuth } from "@/hooks/useAuth";
import { ManagerAdminGate } from "@/components/auth/RoleGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome back{user ? `, ${user.first_name}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-gray-700">
            <p>Email: {user?.email}</p>
            <p>Role: {user?.role}</p>
          </CardContent>
        </Card>

        <ManagerAdminGate
          fallback={
            <Card>
              <CardContent className="text-sm text-gray-500">
                Management tools are available to managers and admins.
              </CardContent>
            </Card>
          }
        >
          <Card>
            <CardHeader>
              <CardTitle>Management</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              This section is visible only to managers and admins.
            </CardContent>
          </Card>
        </ManagerAdminGate>
      </div>
    </div>
  );
}
