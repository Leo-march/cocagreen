import { restoreFocus, trapFocus } from "@/utils/focus"
import { X } from "lucide-react"
import { motion } from "motion/react"
import { type ReactNode, useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"

export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const original = document.body.style.overflow
    const root = document.getElementById("root")
    const originalInert = root?.inert || false
    if (root) root.inert = true
    document.body.style.overflow = "hidden"
    heading.current?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current()
      if (container.current)
        trapFocus(event, container.current, heading.current)
    }
    document.addEventListener("keydown", handler)
    return () => {
      document.body.style.overflow = original
      if (root) root.inert = originalInert
      document.removeEventListener("keydown", handler)
      restoreFocus(previous)
    }
  }, [])
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-7 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2
            ref={heading}
            id={titleId}
            tabIndex={-1}
            className="text-xl font-semibold"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-2 hover:bg-gray-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  )
}
