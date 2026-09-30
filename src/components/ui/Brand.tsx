import { Factory } from "lucide-react"

export default function Brand({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-white ${
        large ? "h-20 w-20" : "h-12 w-12"
      }`}
      aria-label="Gestão de manutenção industrial"
      role="img"
    >
      <Factory size={large ? 36 : 24} strokeWidth={1.5} aria-hidden="true" />
    </div>
  )
}
