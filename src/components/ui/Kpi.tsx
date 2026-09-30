import AnimatedNumber from "@/components/ui/AnimatedNumber"
import Icon from "@/components/ui/Icon"
import { cardClass } from "@/config/styles"
import {
  type LucideIcon,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

export default function Kpi({
  title,
  value,
  suffix,
  change,
  icon,
  data,
  color = "#16866d",
  decimals = 0,
}: {
  title: string
  value: number
  suffix?: string
  change?: string
  icon: LucideIcon
  data?: number[]
  color?: string
  decimals?: number
}) {
  return (
    <div className={`${cardClass} relative overflow-hidden p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <span className="rounded-lg bg-gray-50 p-2 text-[#596270]">
          <Icon icon={icon} size={18} />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-['DM_Sans'] text-[30px] font-semibold leading-none">
          <AnimatedNumber value={value} decimals={decimals} />
        </span>
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs">
        <span
          className={`inline-flex items-center gap-1 ${
            color === "#da291c" ? "text-red-700" : "text-emerald-700"
          }`}
        >
          <Icon
            icon={
              change
                ? title === "MTBF"
                  ? ArrowUpRight
                  : ArrowDownRight
                : RefreshCw
            }
            size={13}
          />
          {change || "Atualizado neste mês"}
        </span>
        {change && (
          <span className="text-muted-foreground">vs. mês anterior</span>
        )}
      </div>
      {data && (
        <div className="absolute right-4 bottom-5 h-10 w-24" aria-hidden="true">
          <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
            <AreaChart
              accessibilityLayer={false}
              data={data.map((point) => ({ value: point }))}
            >
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.06}
                strokeWidth={1.8}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
