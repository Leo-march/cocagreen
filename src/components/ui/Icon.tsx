import { type LucideIcon } from "lucide-react"

export default function Icon({
  icon: IconComponent,
  size = 18,
  className = "",
}: {
  icon: LucideIcon
  size?: number
  className?: string
}) {
  return (
    <IconComponent
      size={size}
      strokeWidth={1.7}
      className={className}
      aria-hidden="true"
    />
  )
}
