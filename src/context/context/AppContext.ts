"use client"

import {
  type Failure,
  type Machine,
  type Order,
  type PrototypeSnapshot,
  type Role,
  type User,
} from "@/types/maintenance"
import type React from "react"
import { createContext, useContext } from "react"

export type ContextValue = {
  prototype: PrototypeSnapshot
  users: User[]
  setUsers: React.Dispatch<React.SetStateAction<User[]>>

  toast: string
  setToast: (value: string) => void

  authenticated: boolean
  setAuthenticated: (value: boolean) => void

  role: Role
  setRole: (value: Role) => void

  analysisFiltersOpen: boolean
  setAnalysisFiltersOpen: (value: boolean) => void

  machines: Machine[]
  setMachines: React.Dispatch<React.SetStateAction<Machine[]>>

  orders: Order[]
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>

  failures: Failure[]
  setFailures: React.Dispatch<React.SetStateAction<Failure[]>>

  history: string[]
  setHistory: React.Dispatch<React.SetStateAction<string[]>>

  notify: (message: string) => void
}

export const AppContext = createContext<ContextValue>(null!)

export const useApp = () => useContext(AppContext)