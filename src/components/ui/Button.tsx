import Icon from "@/components/ui/Icon"
import { type LucideIcon } from "lucide-react"
import { type ReactNode } from "react"

export default function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  ariaLabel,
}: {
  children?: ReactNode
  variant?: "primary" | "secondary" | "ghost"
  icon?: LucideIcon
  onClick?: () => void
  className?: string
  disabled?: boolean
  type?: "button" | "submit"
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        onClick?.()
      }}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
        !disabled ? "active:scale-[0.98]" : ""
      } ${
        disabled
          ? "cursor-not-allowed border border-input bg-gray-100 text-[#42454e]"
          : variant === "primary"
            ? "border border-primary bg-primary text-white shadow-[0_2px_3px_var(--primary-shadow)] hover:border-primary-hover hover:bg-primary-hover"
            : variant === "secondary"
              ? "border border-input bg-white text-gray-700 hover:border-ring hover:bg-gray-50"
              : "text-gray-600 hover:bg-gray-100"
      } ${className}`}
    >
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </button>
  )
}
