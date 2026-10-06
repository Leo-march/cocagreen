'use client';

import ChartFrame from "@/components/charts/ChartFrame"
import SimpleTable from "@/components/tables/SimpleTable"
import AnimatedNumber from "@/components/ui/AnimatedNumber"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import CardHeader from "@/components/ui/CardHeader"
import Field from "@/components/ui/Field"
import Kpi from "@/components/ui/Kpi"
import Modal from "@/components/ui/Modal"
import SectionHeader from "@/components/ui/SectionHeader"
import Select from "@/components/ui/Select"
import { cardClass, tooltipStyle } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { buildHomeReport } from "@/domain/home"
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { motion } from "motion/react"
import { use, useState } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export default function Home() {
  const { prototype } = useApp()

  const [period, setPeriod] = useState("Esta semana")
  const [line, setLine] = useState("Todas as linhas")
  const [calendar, setCalendar] = useState(false)
  const [start, setStart] = useState("2026-09-28")
  const [draftStart, setDraftStart] = useState(start)
  const weekStart = new Date(`${start}T12:00:00`)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const dateLabel = `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
  const { data, weeklyFailures, monthlyFailures } = buildHomeReport(
    prototype.analytics,
    period,
    line,
  )
  return (
    <>
      <SectionHeader
        title="Painel de Manutenção"
        subtitle="Uma visão completa da sua operação. Tudo em um só lugar."
        action={
          <div className="flex flex-wrap gap-2">
            <Select
              value={line}
              onChange={setLine}
              options={["Todas as linhas", "Linha 1", "Linha 2", "Linha 3"]}
              className="w-36"
            />
            <Select
              value={period}
              onChange={(value) => {
                setPeriod(value)
                setStart(
                  value === "Semana anterior" ? "2026-09-21" : "2026-09-28",
                )
              }}
              options={[
                "Esta semana",
                "Semana anterior",
                ...(period === "Personalizado" ? ["Personalizado"] : []),
              ]}
            />
            <Button
              variant="secondary"
              icon={CalendarDays}
              onClick={() => {
                setDraftStart(start)
                setCalendar(true)
              }}
            >
              {dateLabel}
            </Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="mr-1 text-muted-foreground">Status da operação</span>
          {["Operando", "Parada", "Aguardando peça"].map((status) => (
            <Badge key={status} status={status} />
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-800">
          <ShieldCheck size={14} />
          Dados conferidos com o SAP
        </span>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="MTTR"
          value={prototype.views.homeMTTR}
          decimals={1}
          suffix="horas"
          change="12,8%"
          icon={Wrench}
          data={prototype.views.sparklineMTTR}
        />
        <Kpi
          title="MTBF"
          value={prototype.views.homeMTBF}
          suffix="horas"
          change="8,2% de melhora"
          icon={Activity}
          data={prototype.views.sparklineMTBF}
        />
        <Kpi
          title="Falhas no mês"
          value={monthlyFailures}
          change="15,4%"
          icon={CircleAlert}
          data={prototype.views.sparklineMonthlyFailures}
        />
        <Kpi
          title="Média de parada"
          value={prototype.views.homeAverageDowntime}
          suffix="min"
          change="9,6%"
          icon={Clock3}
          data={prototype.views.sparklineAverageDowntime}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.38fr_1fr_0.95fr]">
        <section aria-label="Falhas por dia" className={`${cardClass} p-5`}>
          <CardHeader
            title="Falhas por dia"
            subtitle="Ocorrências registradas na semana"
            action={
              <Link
                href="/analises"
                aria-label="Ver análise de falhas"
                className="rounded-md p-2 text-[#596270] hover:bg-gray-50"
              >
                <ArrowUpRight size={16} />
              </Link>
            }
          />
          <div className="mb-1 mt-5 flex gap-4 text-[10px] text-[#596270]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary" />
              Semana atual
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-sm border border-ring bg-[repeating-linear-gradient(135deg,var(--chart-soft)_0_2px,var(--support)_2px_3px)]"
              />
              Semana anterior
            </span>
          </div>
          <ChartFrame>
            <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
              <BarChart
                accessibilityLayer={false}
                data={data}
                barGap={4}
                margin={{ top: 15, right: 0, left: -30, bottom: 0 }}
              >
                <defs>
                  <pattern
                    id="previous-week-hatch"
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--chart-soft)" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="var(--support)"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#eef0f3"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#42454e" }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    Number(value).toLocaleString("pt-BR")
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#42454e" }}
                  domain={[0, 20]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#f8f8fa" }}
                />
                <Bar
                  dataKey="anterior"
                  name="Semana anterior"
                  fill="url(#previous-week-hatch)"
                  stroke="var(--support)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                >
                  <LabelList
                    dataKey="anterior"
                    position="top"
                    fill="#42454e"
                    fontSize={10}
                  />
                </Bar>
                <Bar
                  dataKey="falhas"
                  name="Semana atual"
                  fill="var(--primary)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                >
                  <LabelList
                    dataKey="falhas"
                    position="top"
                    fill="#42454e"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {weeklyFailures} falhas registradas no período selecionado.
          </p>
          <details className="mt-3 rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-3 text-xs font-semibold">
              Ver dados por dia
            </summary>
            <SimpleTable
              caption="Falhas por dia: comparação entre semanas"
              headings={["Dia", "Semana atual", "Semana anterior"]}
              rows={data.map((item) => [item.day, item.falhas, item.anterior])}
            />
          </details>
        </section>
        <section aria-label="Disponibilidade" className={`${cardClass} p-5`}>
          <CardHeader
            title="Disponibilidade"
            subtitle="Tempo disponível para produzir"
          />
          <div className="relative mt-3 h-[215px]">
            <ResponsiveContainer aria-hidden="true" width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie
                  rootTabIndex={-1}
                  data={prototype.views.availabilityData}
                  dataKey="value"
                  innerRadius={73}
                  outerRadius={89}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  paddingAngle={3}
                >
                  <Cell fill="#16866d" />
                  <Cell fill="#596270" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['DM_Sans'] text-[35px] font-bold">
                <AnimatedNumber
                  value={prototype.views.availabilityData[0].value}
                  decimals={1}
                />
                <span className="text-xl">%</span>
              </span>
              <span className="mt-1 text-xs text-[#596270]">
                do tempo disponível
              </span>
            </div>
          </div>
          <div className="mt-1 flex justify-center gap-2 text-xs text-emerald-700">
            <TrendingUp size={14} />
            2,1% acima do mês anterior
          </div>
          <p className="mt-4 text-center text-[10px] text-[#42454e]">
            Situação atual · 27 equipamentos
          </p>
          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
            <div>
              <p className="text-lg font-semibold">
                {prototype.views.operatingSummary.operating}
              </p>
              <p className="text-[10px] text-[#596270]">Operando</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {prototype.views.operatingSummary.stopped}
              </p>
              <p className="text-[10px] text-[#596270]">Paradas</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {prototype.views.operatingSummary.awaiting}
              </p>
              <p className="text-[10px] text-[#596270]">Aguardando</p>
            </div>
          </div>
        </section>
        <section
          aria-label="Manutenção por tipo"
          className={`${cardClass} p-5`}
        >
          <CardHeader
            title="Manutenção por tipo"
            subtitle="Distribuição de ordens neste mês"
          />
          <div className="mt-6 space-y-5">
            {prototype.views.maintenanceTypes.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-gray-600">{item.name}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 1 }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {calendar && (
        <Modal title="Selecionar semana" onClose={() => setCalendar(false)}>
          <p className="mb-5 text-sm text-gray-600">
            Escolha o início do período de 7 dias para explorar o cenário de
            demonstração.
          </p>
          <Field
            label="Início da semana"
            name="week"
            type="date"
            value={draftStart}
            onChange={setDraftStart}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCalendar(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!draftStart}
              onClick={() => {
                setStart(draftStart)
                setPeriod("Personalizado")
                setCalendar(false)
              }}
            >
              Aplicar período
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
