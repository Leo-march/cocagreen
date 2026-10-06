"use client"

import { AppContext } from "@/context/AppContext"
import { saveMaintenanceRecords } from "@/services/maintenanceService"
import type { PrototypeSnapshot, Role } from "@/types/maintenance"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

export default function AppProvider({
  initialSnapshot,
  children,
}: {
  initialSnapshot: PrototypeSnapshot
  children: ReactNode
}) {
  const [authenticated, setAuthenticated] = useState(false)
  const [role, setRole] = useState<Role>("Analista")
  const [analysisFiltersOpen, setAnalysisFiltersOpen] = useState(false)

  const [machines, setMachines] = useState(initialSnapshot.machines)
  const [orders, setOrders] = useState(initialSnapshot.orders)
  const [failures, setFailures] = useState(initialSnapshot.failures)

  const [history, setHistory] = useState(
    initialSnapshot.views.initialHistory,
  )

  const [toast, setToast] = useState("")

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = (message: string) => {
    setToast(message)

    if (timer.current) {
      clearTimeout(timer.current)
    }

    timer.current = setTimeout(() => {
      setToast("")
    }, 5000)
  }

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  const [users, setUsers] = useState(initialSnapshot.views.initialUsers)

  const previousRecords = useRef({
    machines,
    orders,
    failures,
    history,
    users,
  })

  useEffect(() => {
    const next = {
      machines,
      orders,
      failures,
      history,
      users,
    }

    const changed = !Object.keys(next).every((key) => {
      const typedKey = key as keyof typeof next

      return (
        next[typedKey] ===
        previousRecords.current[typedKey]
      )
    })

    if (!changed) {
      return
    }

    previousRecords.current = next

    void saveMaintenanceRecords(next).catch(() => {
      notify("Não foi possível salvar os dados. Tente novamente.")
    })
  }, [machines, orders, failures, history, users])

  return (
    <AppContext.Provider
      value={{
        prototype: initialSnapshot,

        users,
        setUsers,

        toast,
        setToast,

        authenticated,
        setAuthenticated,

        role,
        setRole,

        analysisFiltersOpen,
        setAnalysisFiltersOpen,

        machines,
        setMachines,

        orders,
        setOrders,

        failures,
        setFailures,

        history,
        setHistory,

        notify,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}