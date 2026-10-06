import BootstrapState from "@/components/ui/BootstrapState"
import { getPrototypeSnapshot } from "@/services/maintenanceService"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Manutenção Industrial",
  description: "Gestão de manutenção industrial · Unidade Marília",
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const snapshot = await getPrototypeSnapshot()

  return (
    <html lang="pt-BR">
      <body>
        <BootstrapState snapshot={snapshot}>
          {children}
        </BootstrapState>
      </body>
    </html>
  )
}