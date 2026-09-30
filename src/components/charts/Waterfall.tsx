import ChartFrame from "@/components/charts/ChartFrame"
import { tooltipStyle } from "@/config/styles"
import { type ChartModels } from "@/domain/analytics"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export default function Waterfall({
  source,
}: {
  source: ChartModels["waterfall"]
}) {
  return (
    <>
      <ChartFrame height={320}>
        <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={source}
            margin={{ top: 25, left: 0, right: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#eceef2"
            />
            <XAxis
              dataKey="cause"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
              domain={[0, "auto"]}
              unit=" min"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: any, name: any) =>
                name === "base"
                  ? ["", ""]
                  : [`${Math.round(Number(value))} min`, "Variação"]
              }
            />
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />
            <Bar
              dataKey="value"
              stackId="waterfall"
              maxBarSize={60}
              radius={[4, 4, 0, 0]}
              label={false}
            >
              <LabelList
                dataKey="delta"
                position="top"
                formatter={(value: any) =>
                  `${Number(value) > 0 ? "+" : ""}${value} min`
                }
                fill="#42454e"
                fontSize={10}
              />
              {source.map((item) => (
                <Cell
                  key={item.cause}
                  fill={
                    item.total
                      ? "var(--primary)"
                      : item.delta > 0
                        ? "#da291c"
                        : "#298570"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        {source.map((item) => (
          <span
            key={item.cause}
            className={
              item.total
                ? "text-gray-600"
                : item.delta > 0
                  ? "text-red-700"
                  : "text-emerald-800"
            }
          >
            {item.cause}: {item.total ? "" : item.delta > 0 ? "+" : "−"}
            {Math.abs(item.delta)} min
          </span>
        ))}
      </div>
    </>
  )
}
