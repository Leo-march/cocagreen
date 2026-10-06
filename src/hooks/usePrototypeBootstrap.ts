import { getPrototypeSnapshot } from "@/services/maintenanceService"
import { type PrototypeSnapshot } from "@/types/maintenance"
import { useEffect, useState } from "react"

export function usePrototypeBootstrap(initialSnapshot?: PrototypeSnapshot) {
  const [data, setData] = useState(initialSnapshot || null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (initialSnapshot) return
    let active = true
    setError("")
    void getPrototypeSnapshot()
      .then((snapshot) => {
        if (active) setData(snapshot)
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar os dados. Tente novamente.")
      })
    return () => {
      active = false
    }
  }, [initialSnapshot, attempt])
  return { data, error, retry: () => setAttempt((value) => value + 1) }
}
