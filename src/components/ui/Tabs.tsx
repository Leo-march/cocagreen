import { tabButtonId, tabPanelId } from "@/utils/tabs"
import { motion } from "motion/react"

export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label={"Abas: " + tabs.join(", ")}
      className="flex gap-2 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab}
          id={tabButtonId(tabs[0], tab)}
          role="tab"
          aria-selected={active === tab}
          aria-controls={tabPanelId(tabs[0])}
          tabIndex={active === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + tabs.length) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : -1
            if (next < 0) return
            event.preventDefault()
            onChange(tabs[next])
            document.getElementById(tabButtonId(tabs[0], tabs[next]))?.focus()
          }}
          className={
            "relative min-h-11 shrink-0 px-4 pb-3 pt-2 text-xs font-semibold transition " +
            (active === tab
              ? "text-accent-foreground"
              : "text-[#596270] hover:text-gray-800")
          }
        >
          {tab}
          {active === tab && (
            <motion.div
              layoutId={"tab-" + tabs[0]}
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
            />
          )}
        </button>
      ))}
    </div>
  )
}
