import ChartFrame from "@/components/charts/ChartFrame"
import { tooltipStyle } from "@/config/styles"
import { type ChartModels } from "@/domain/analytics"
import { CircleAlert } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export default function ControlChart({
  model,
}: {
  model: ChartModels["control"]
}) {
  return (
    <>
      <ChartFrame>
        <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
          <LineChart
            accessibilityLayer={false}
            data={model.data}
            margin={{ top: 20, right: 45, left: 0, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#eceef2"
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
              domain={[0, model.domainMaximum]}
              tick={{ fontSize: 10 }}
              unit=" min"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <ReferenceLine
              y={model.upperLimit}
              stroke="var(--support-muted)"
              strokeDasharray="5 5"
              label={{
                value: "LSC",
                fill: "var(--chart-label)",
                fontSize: 10,
                position: "right",
              }}
            />
            <ReferenceLine
              y={model.mean}
              stroke="#667988"
              label={{
                value: "Média",
                fill: "#667988",
                fontSize: 10,
                position: "right",
              }}
            />
            <ReferenceLine
              y={model.lowerLimit}
              stroke="var(--support-muted)"
              strokeDasharray="5 5"
              label={{
                value: "LIC",
                fill: "var(--chart-label)",
                fontSize: 10,
                position: "right",
              }}
            />
            <Line
              dataKey="value"
              name="Parada (min)"
              stroke="#697e8e"
              strokeWidth={2}
              dot={(props: any) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={props.payload.outsideLimit ? "#da291c" : "#697e8e"}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="mt-3 flex items-center gap-2 text-xs text-[#596270]">
        <CircleAlert size={14} className="text-accent-foreground" />
        Dia {model.outlierDay}: {model.outlierMinutes} min, acima do limite
        superior ({Math.round(model.upperLimit)} min). Investigue a causa
        especial.
      </p>
    </>
  )
}
