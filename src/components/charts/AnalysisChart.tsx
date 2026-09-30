import ChartFrame from "@/components/charts/ChartFrame"
import ControlChart from "@/components/charts/ControlChart"
import Heatmap from "@/components/charts/Heatmap"
import JackKnife from "@/components/charts/JackKnife"
import StackedCategoryLabel from "@/components/charts/StackedCategoryLabel"
import Waterfall from "@/components/charts/Waterfall"
import SimpleTable from "@/components/tables/SimpleTable"
import Empty from "@/components/ui/Empty"
import { tooltipStyle } from "@/config/styles"
import { type ChartModels } from "@/domain/analytics"
import { type ParetoPoint, type SeriesPoint } from "@/types/maintenance"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts"

export default function AnalysisChart({
  chart,
  data,
  series,
  factor,
  critical = ["A", "B", "C"],
  models,
}: {
  models: ChartModels
  chart: string
  data: ParetoPoint[]
  series: SeriesPoint[]
  factor: number
  critical?: string[]
}) {
  if (factor === 0)
    return (
      <Empty
        title="Nenhum dado para este recorte"
        description="Selecione ao menos uma criticidade para visualizar a análise."
      />
    )
  if (chart === "Pareto")
    return (
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <ChartFrame height={320}>
            <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
              <ComposedChart
                accessibilityLayer={false}
                data={data}
                margin={{ top: 20, left: -15, right: 0, bottom: 10 }}
              >
                <defs>
                  <pattern
                    id="projection-hatch"
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="#ffffff" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="#596270"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 4"
                  stroke="#eceef2"
                />
                <XAxis
                  dataKey="cause"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) =>
                    Number(value).toLocaleString("pt-BR")
                  }
                  yAxisId="count"
                  domain={[0, "auto"]}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) =>
                    Number(value).toLocaleString("pt-BR")
                  }
                  yAxisId="percent"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(value) => (
                    <span className="text-[#42454e]">{value}</span>
                  )}
                  wrapperStyle={{ fontSize: 11, paddingTop: 15 }}
                />
                <Bar
                  dataKey="ocorrencias"
                  name="Ocorrências"
                  yAxisId="count"
                  maxBarSize={32}
                  radius={[4, 4, 0, 0]}
                >
                  {data.map((item) => (
                    <Cell
                      key={item.cause}
                      fill={
                        item.acumulado > 80
                          ? "var(--support-muted)"
                          : "var(--primary)"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="ocorrencias"
                    position="top"
                    fill="#42454e"
                    fontSize={10}
                  />
                </Bar>
                <Bar
                  dataKey="projecao"
                  name="Projeção IA"
                  yAxisId="count"
                  fill="url(#projection-hatch)"
                  stroke="#596270"
                  maxBarSize={16}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList
                    dataKey="projecao"
                    position="top"
                    fill="#42454e"
                    fontSize={10}
                  />
                </Bar>
                <Line
                  yAxisId="percent"
                  dataKey="acumulado"
                  name="% acumulado"
                  stroke="var(--pareto-line)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <ReferenceLine
                  yAxisId="percent"
                  y={80}
                  stroke="#596270"
                  strokeDasharray="5 5"
                  label={{
                    value: "80%",
                    fontSize: 11,
                    fill: "#6b7280",
                    position: "insideTopLeft",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-2 text-xs text-[#596270]">
            Mecânica, elétrica e sensor concentram 80% das ocorrências.
          </p>
        </div>
        <div className="rounded-lg border border-border">
          <SimpleTable
            headings={["Causa", "Falhas", "% acum."]}
            rows={data.map((item) => [
              item.cause,
              item.ocorrencias,
              `${item.acumulado.toLocaleString("pt-BR")}%`,
            ])}
          />
        </div>
      </div>
    )
  if (chart === "Jack-Knife") return <JackKnife model={models.jackKnife} />
  if (chart === "Mapa de calor") return <Heatmap model={models.heatmap} />
  if (chart === "Carta de controle")
    return <ControlChart model={models.control} />
  if (chart === "Cascata") return <Waterfall source={models.waterfall} />
  if (chart === "Treemap")
    return (
      <div>
        <ChartFrame height={320}>
          <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
            <Treemap
              isAnimationActive={false}
              data={models.treemap}
              dataKey="value"
              nameKey="name"
              stroke="#fff"
              content={(props: any) =>
                props.depth === 0 ? (
                  <g />
                ) : (
                  <g>
                    <rect
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      stroke="white"
                      strokeWidth={4}
                      rx={8}
                      fill={
                        [
                          "var(--primary)",
                          "var(--support)",
                          "#8e5260",
                          "#566776",
                        ][props.index % 4]
                      }
                    />
                    <text
                      x={props.x + 20}
                      y={props.y + props.height / 2}
                      fill="white"
                      fontSize={14}
                      fontWeight={600}
                    >
                      {props.name}
                    </text>
                    <text
                      x={props.x + 20}
                      y={props.y + props.height / 2 + 22}
                      fill="white"
                      fontSize={12}
                    >
                      {props.value} falhas
                    </text>
                  </g>
                )
              }
            >
              <Tooltip contentStyle={tooltipStyle} />
            </Treemap>
          </ResponsiveContainer>
        </ChartFrame>
        <p className="mt-4 text-xs text-[#596270]">
          Área proporcional à frequência: mecânica 38,2%, elétrica 25,4%,
          sensores 16,4%, outras 20%.
        </p>
      </div>
    )
  if (chart === "Rosca")
    return (
      <div className="grid items-center gap-6 sm:grid-cols-2">
        <div className="relative h-72">
          <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                rootTabIndex={-1}
                data={models.grouped}
                dataKey="ocorrencias"
                nameKey="cause"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
              >
                {["var(--primary)", "var(--support)", "#596270", "var(--chart-projection)"].map(
                  (color) => (
                    <Cell key={color} fill={color} />
                  ),
                )}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <SimpleTable
          headings={["Causa", "Ocorrências"]}
          rows={models.grouped.map((item) => [item.cause, item.ocorrencias])}
        />
      </div>
    )
  if (chart === "Linha com meta/projeção")
    return (
      <>
        <ChartFrame height={320}>
          <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
            <LineChart
              accessibilityLayer={false}
              data={series}
              margin={{ top: 15, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 4"
                stroke="#eceef2"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
                domain={[0, "auto"]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                unit=" min"
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                formatter={(value) => (
                  <span className="text-[#42454e]">{value}</span>
                )}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                name="Realizado (min)"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
              <Line
                dataKey="meta"
                name="Meta (min)"
                stroke="#596270"
                strokeDasharray="8 5"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="projecao"
                name="Projeção IA (min)"
                stroke="var(--support)"
                strokeDasharray="2 5"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
        <p className="mt-3 text-xs text-[#596270]">
          Setembro: realizado {models.latestSeries.realizado} min · meta{" "}
          {models.latestSeries.meta} min · projeção{" "}
          {models.latestSeries.projecao} min. Projeção não é dado realizado.
        </p>
      </>
    )
  return (
    <>
      <ChartFrame height={320}>
        <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={models.stacked}
            margin={{ left: 0, right: 15, top: 20, bottom: 10 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 4"
              stroke="#eceef2"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
              domain={[0, "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              unit=" min"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              formatter={(value) => (
                <span className="text-[#42454e]">{value}</span>
              )}
              wrapperStyle={{ fontSize: 11 }}
            />
            {critical.includes("A") && (
              <Bar
                dataKey="A"
                name="A · Parada geral"
                stackId="critical"
                fill="#da291c"
                maxBarSize={48}
              >
                <LabelList
                  content={(props: any) => (
                    <StackedCategoryLabel {...props} category="A" />
                  )}
                />
              </Bar>
            )}
            {critical.includes("B") && (
              <Bar
                dataKey="B"
                name="B · Intermediária"
                stackId="critical"
                fill="#7b3306"
                maxBarSize={48}
              >
                <LabelList
                  content={(props: any) => (
                    <StackedCategoryLabel {...props} category="B" />
                  )}
                />
              </Bar>
            )}
            {critical.includes("C") && (
              <Bar
                dataKey="C"
                name="C · Equipamento"
                stackId="critical"
                fill="#005c46"
                maxBarSize={48}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  content={(props: any) => (
                    <StackedCategoryLabel {...props} category="C" />
                  )}
                />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="mt-3 text-xs text-[#596270]">
        Paradas por criticidade, em minutos: setembro{" "}
        {models.latestSeries.realizado} min. Criticidades selecionadas:{" "}
        {critical.join(" · ")}.
      </p>
    </>
  )
}
