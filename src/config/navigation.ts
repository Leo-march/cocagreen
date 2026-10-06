import {
  type LucideIcon,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Factory,
  LayoutDashboard,
  Package,
  Sparkles,
  Tags,
  Upload,
} from "lucide-react"

export const navigation: {
  path: string
  label: string
  icon: LucideIcon
  badge?: string
  section: "operacao" | "administracao"
}[] = [
  {
    path: "/painel",
    label: "Painel principal",
    icon: LayoutDashboard,
    section: "operacao",
  },
  { path: "/maquinas", label: "Máquinas", icon: Factory, section: "operacao" },
  {
    path: "/classificacao",
    label: "Classificação de falhas",
    icon: Tags,
    badge: "5",
    section: "operacao",
  },
  {
    path: "/analises",
    label: "Análises",
    icon: ChartNoAxesCombined,
    section: "operacao",
  },
  {
    path: "/import",
    label: "Importação de dados",
    icon: Upload,
    section: "administracao",
  },
]

export const notificationIcons: Record<string, LucideIcon> = {
  CircleAlert,
  Clock3,
  Package,
  Sparkles,
}
