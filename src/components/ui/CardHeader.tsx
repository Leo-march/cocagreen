import { type ReactNode } from "react"

export default function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
