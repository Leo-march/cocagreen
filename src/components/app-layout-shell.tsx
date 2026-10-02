"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  return isAuthPage ? <>{children}</> : <AppShell>{children}</AppShell>;
}
