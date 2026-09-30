import { type ReactNode } from "react"

export default function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1
          tabIndex={-1}
          className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-primary"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
