"use client"

import AppProvider from "@/context/AppProvider"
import type { PrototypeSnapshot } from "@/types/maintenance"
import type { ReactNode } from "react"

export default function BootstrapState({
  snapshot,
  children,
}: {
  snapshot: PrototypeSnapshot
  children: ReactNode
}) {
  return (
    <AppProvider initialSnapshot={snapshot}>
      {children}
    </AppProvider>
  )
}