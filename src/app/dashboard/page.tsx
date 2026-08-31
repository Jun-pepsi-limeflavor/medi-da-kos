"use client";

import { CMWizard } from "@/components/dashboard/CMWizard";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <CMWizard />;
}
