import Icon from "@/components/ui/Icon"
import { ClipboardList } from "lucide-react"
import { type ReactNode } from "react"

export default function Empty({
  title = "Nenhuma ordem de serviço por aqui",
  description = "Ajuste os filtros ou abra a primeira ordem de serviço.",
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-gray-50 p-5 text-[#596270]">
        <Icon icon={ClipboardList} size={32} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-5 mt-2 text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}
