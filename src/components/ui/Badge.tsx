import Icon from "@/components/ui/Icon"
import { CheckCircle2, CircleAlert, ClipboardList, Clock3 } from "lucide-react"

export default function Badge({
  status,
  critical = false,
}: {
  status: string
  critical?: boolean
}) {
  const green = critical
    ? status === "C"
    : ["Operando", "Concluída", "Aprovada", "Ativo", "Importado"].includes(
        status,
      )
  const red = critical
    ? status === "A"
    : ["Parada", "Alta", "Atrasada", "Crítico"].includes(status)
  const neutral = ["Aberta", "Baixa"].includes(status)
  return (
    <span
      title={
        critical
          ? {
              A: "Parada geral da produção",
              B: "Impacto intermediário na linha",
              C: "Parada apenas do equipamento",
            }[status]
          : undefined
      }
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${
        green
          ? "bg-emerald-50 text-emerald-800"
          : red
            ? "bg-red-50 text-red-700"
            : neutral
              ? "bg-slate-100 text-slate-600"
              : "bg-amber-50 text-amber-800"
      }`}
    >
      {critical ? (
        <span className="font-bold">{status}</span>
      ) : (
        <Icon
          icon={
            green
              ? CheckCircle2
              : red
                ? CircleAlert
                : neutral
                  ? ClipboardList
                  : Clock3
          }
          size={12}
        />
      )}
      {critical ? `Criticidade ${status}` : status}
    </span>
  )
}
