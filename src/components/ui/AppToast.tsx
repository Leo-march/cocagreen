import { useApp } from "@/context/AppContext"
import { CheckCircle2, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

export default function AppToast() {
  const { toast, setToast } = useApp()
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-6 left-1/2 z-[100] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-[#252c34] px-5 py-4 text-sm text-white shadow-xl"
        >
          <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Fechar aviso"
            className="ml-2 p-1 text-white/70"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
