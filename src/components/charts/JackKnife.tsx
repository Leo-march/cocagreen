import ChartFrame from "@/components/charts/ChartFrame"
import { tooltipStyle } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { type ChartModels } from "@/domain/analytics"
import {
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export default function JackKnife({
  model,
}: {
  model: ChartModels["jackKnife"]
}) {
  const { prototype } = useApp()

  const { points, meanX, meanY } = model
  return (
    <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <div className="relative overflow-hidden rounded-lg">
        <ChartFrame height={320}>
          <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
            <ScatterChart
              accessibilityLayer={false}
              margin={{ top: 20, right: 35, left: 20, bottom: 30 }}
            >
              <XAxis
                type="number"
                scale="log"
                dataKey="x"
                domain={[1, 30]}
                ticks={[1, 2, 5, 10, 20, 30]}
                name="Frequência"
                tick={{ fontSize: 10 }}
                label={{
                  value: "Frequência de falhas (log)",
                  position: "bottom",
                  fontSize: 11,
                  offset: 10,
                }}
              />
              <YAxis
                tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
                type="number"
                scale="log"
                dataKey="y"
                domain={[0.3, 10]}
                ticks={[0.5, 1, 2, 5, 10]}
                name="MTTR"
                unit=" h"
                tick={{ fontSize: 10 }}
                label={{
                  value: "MTTR (log, h)",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  offset: -6,
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <ReferenceArea
                x1={1}
                x2={meanX}
                y1={meanY}
                y2={10}
                fill="#f0c451"
                fillOpacity={0.15}
                stroke="none"
                label={{
                  value: "Falhas agudas",
                  fontSize: 10,
                  fill: "#856114",
                  position: "insideTopLeft",
                }}
              />
              <ReferenceArea
                x1={meanX}
                x2={30}
                y1={meanY}
                y2={10}
                fill="#da291c"
                fillOpacity={0.15}
                stroke="none"
                label={{
                  value: "Zona crítica",
                  fontSize: 10,
                  fill: "#a32921",
                  position: "insideTopRight",
                }}
              />
              <ReferenceArea
                x1={1}
                x2={meanX}
                y1={0.3}
                y2={meanY}
                fill="#21856b"
                fillOpacity={0.15}
                stroke="none"
                label={{
                  value: "Controlada",
                  fontSize: 10,
                  fill: "#18624e",
                  position: "insideBottomLeft",
                }}
              />
              <ReferenceArea
                x1={meanX}
                x2={30}
                y1={0.3}
                y2={meanY}
                fill="#c05d7a"
                fillOpacity={0.15}
                stroke="none"
                label={{
                  value: "Falhas crônicas",
                  fontSize: 10,
                  fill: "#864156",
                  position: "insideBottomRight",
                }}
              />
              <ReferenceLine
                x={meanX}
                stroke="#596270"
                strokeDasharray="5 4"
                label={{
                  value: `Média: ${meanX.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`,
                  fontSize: 9,
                  position: "insideTopRight",
                }}
              />
              <ReferenceLine
                y={meanY}
                stroke="#596270"
                strokeDasharray="5 4"
                label={{
                  value: `Média: ${meanY.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`,
                  fontSize: 9,
                }}
              />
              <Scatter
                name="Máquina"
                data={points}
                fill="var(--primary)"
                shape={(props: any) => (
                  <g>
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill="var(--primary)"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                    <text
                      x={props.cx + 8}
                      y={props.cy - 7}
                      fontSize={9}
                      fill="#38404a"
                    >
                      {props.payload.name}
                    </text>
                  </g>
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Máquinas por zona</h3>
        <div className="mt-4 space-y-4">
          {prototype.views.machineZones.map((item) => (
            <div key={item.zone} className={`rounded-lg p-3 ${item.color}`}>
              <p className="text-xs font-semibold">{item.zone}</p>
              <p className="mt-1 text-[11px]">{item.machines}</p>
              <p className="mt-1 text-[10px] ">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
