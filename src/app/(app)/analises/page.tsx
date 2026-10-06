"use client";

import AnalysisChart from "@/components/charts/AnalysisChart"
import ChartDataAlternative from "@/components/charts/ChartDataAlternative"
import ControlChart from "@/components/charts/ControlChart"
import AccessibleForm from "@/components/ui/AccessibleForm"
import Button from "@/components/ui/Button"
import CardHeader from "@/components/ui/CardHeader"
import Kpi from "@/components/ui/Kpi"
import Modal from "@/components/ui/Modal"
import SectionHeader from "@/components/ui/SectionHeader"
import Select from "@/components/ui/Select"
import Tabs from "@/components/ui/Tabs"
import { defaultChart, defaultFilters, graphOptions } from "@/config/analysis"
import { cardClass, inputClass } from "@/config/styles"
import { useApp } from "@/context/AppContext"
import { useAnalysisReport } from "@/hooks/useAnalysisReport"
import { type AnalysisFilters } from "@/types/maintenance"
import { restoreFocus, trapFocus } from "@/utils/focus"
import { tabButtonId, tabPanelId } from "@/utils/tabs"
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export default function Analyses() {
  const { prototype } = useApp()

  const {
    notify,
    machines,
    analysisFiltersOpen: filterOpen,
    setAnalysisFiltersOpen: setFilterOpen,
  } = useApp()
  const [tab, setTab] = useState("Visão geral")
  const [chart, setChart] = useState(
    () =>
      localStorage.getItem("kof-chart") || "Barras empilhadas por criticidade",
  )
  const [filters, setFilters] = useState<AnalysisFilters>(defaultFilters)
  const [draft, setDraft] = useState<AnalysisFilters>(defaultFilters)
  const [saved, setSaved] = useState<{
    name: string
    filters: AnalysisFilters
  }[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kof-filters") || "null")
      if (Array.isArray(stored)) return stored
    } catch {}
    return [
      {
        name: "Linha 3 · Todos os turnos",
        filters: { ...defaultFilters, line: "Linha 3" },
      },
    ]
  })
  useEffect(() => {
    localStorage.setItem("kof-filters", JSON.stringify(saved))
  }, [saved])
  const drawerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!filterOpen) return
    setDraft(filters)
    const previous = document.activeElement as HTMLElement
    const root = document.getElementById("root")
    const originalInert = root?.inert || false
    const originalOverflow = document.body.style.overflow
    if (root) root.inert = true
    document.body.style.overflow = "hidden"
    const timer = setTimeout(
      () => drawerRef.current?.querySelector<HTMLElement>("h2")?.focus(),
      50,
    )
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false)
      if (drawerRef.current)
        trapFocus(
          event,
          drawerRef.current,
          drawerRef.current.querySelector<HTMLElement>("h2"),
        )
    }
    document.addEventListener("keydown", handler)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handler)
      if (root) root.inert = originalInert
      document.body.style.overflow = originalOverflow
      restoreFocus(previous)
    }
  }, [filterOpen, filters])
  const [exportOpen, setExportOpen] = useState(false)
  const [email, setEmail] = useState(prototype.views.demoProfile.email)
  const [chartSaved, setChartSaved] = useState(
    () => localStorage.getItem("kof-chart") || "",
  )
  const {
    factor,
    analysisData,
    occurrenceTotal,
    series,
    periodSummary,
    models,
    tables,
    downtimeMinutes,
  } = useAnalysisReport(prototype.analytics, filters)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Unidade Marília. ${periodSummary}`)
      notify("Resumo copiado. Pronto para colar no e-mail.")
    } catch {
      notify(
        "Cópia não disponível neste navegador. Selecione o resumo para copiar.",
      )
    }
  }
  const setFilter = (key: keyof AnalysisFilters, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }))
  return (
    <>
      <SectionHeader
        title="Análises de Manutenção"
        subtitle="Transforme o histórico da operação em decisões mais precisas."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              onClick={() => {
                setDraft(filters)
                setFilterOpen(true)
              }}
            >
              Filtros
            </Button>
            <Button icon={Download} onClick={() => setExportOpen(true)}>
              Exportar
            </Button>
          </div>
        }
      />
      <section
        aria-label="Abas de análises"
        className={`${cardClass} mb-5 px-3 pt-2`}
      >
        <Tabs
          tabs={Object.keys(defaultChart)}
          active={tab}
          onChange={(value) => {
            setTab(value)
            setChart(defaultChart[value])
          }}
        />
      </section>
      <div
        role="tabpanel"
        id={tabPanelId("Visão geral")}
        aria-labelledby={tabButtonId("Visão geral", tab)}
        tabIndex={0}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="rounded-md border border-border bg-white px-3 py-2">
              <CalendarDays size={12} className="mr-1.5 inline" />
              {filters.period} de {filters.year}
            </span>
            <span className="rounded-md border border-border bg-white px-3 py-2">
              {filters.line}
            </span>
            <span className="rounded-md border border-border bg-white px-3 py-2">
              {filters.shift}
            </span>
            <span className="rounded-md border border-border bg-white px-3 py-2">
              Criticidade {filters.critical.join(" · ") || "nenhuma"}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-800">
            <ShieldCheck size={14} />
            Total confere com o SAP{" "}
            <span className="text-[#596270]">· 30/09/2026, 08:32</span>
          </span>
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Kpi
            title="Minutos de parada"
            value={downtimeMinutes}
            suffix="min"
            change="16,3%"
            icon={Clock3}
          />
          <Kpi
            title="Ocorrências no período"
            value={occurrenceTotal}
            icon={CircleAlert}
          />
          <Kpi
            title="Disponibilidade da operação"
            value={prototype.views.analysisAvailability}
            suffix="%"
            decimals={1}
            icon={Activity}
          />
        </div>
        <section
          aria-label="Gráficos técnicos de manutenção"
          className={`${cardClass} p-5`}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {["Pareto", "Rosca", "Treemap"].includes(chart)
                  ? "Ocorrências de falhas por causa"
                  : chart === "Jack-Knife"
                    ? "Frequência de falhas × tempo médio de reparo"
                    : chart === "Mapa de calor"
                      ? "Minutos de parada por turno e dia"
                      : chart === "Cascata"
                        ? "Variação dos minutos de parada por causa"
                        : chart === "Carta de controle"
                          ? "Estabilidade dos minutos de parada"
                          : chart === "Linha com meta/projeção"
                            ? "Minutos de parada por mês"
                            : "Minutos de parada por criticidade"}
              </h2>
              <p className="mt-1 text-xs text-[#596270]">
                {filters.period} de {filters.year} · {filters.line} · dados
                ilustrativos
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={chart}
                onChange={setChart}
                options={graphOptions}
                className="w-56"
              />
              <Button
                variant="secondary"
                icon={Settings2}
                onClick={() => {
                  localStorage.setItem("kof-chart", chart)
                  setChartSaved(chart)
                  notify(`${chart} salvo como tipo de gráfico padrão.`)
                }}
              >
                Salvar tipo de gráfico
              </Button>
            </div>
          </div>
          {chartSaved && (
            <p className="mb-4 flex items-center gap-1 text-[10px] text-[#596270]">
              <Check size={12} />
              Padrão salvo: {chartSaved}
              <button
                className="ml-2 min-h-10 text-accent-foreground underline"
                onClick={() => setChart(chartSaved)}
              >
                Aplicar
              </button>
            </p>
          )}
          <motion.div
            key={`${chart}-${JSON.stringify(filters)}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AnalysisChart
              chart={chart}
              data={analysisData}
              series={series}
              factor={factor}
              critical={filters.critical}
              models={models}
            />
            <ChartDataAlternative
              chart={chart}
              factor={factor}
              critical={filters.critical}
              table={tables[chart]}
            />
          </motion.div>
        </section>
        {tab === "Acompanhamento de Paradas" &&
          chart !== "Carta de controle" && (
            <section
              aria-label="Carta de controle · minutos de parada"
              className={`${cardClass} mt-5 p-5`}
            >
              <CardHeader
                title="Carta de controle · minutos de parada"
                subtitle="Média do processo e limites estatísticos — não são limites de erro aceitável."
              />
              <div className="mt-5">
                <ControlChart model={models.control} />
                <ChartDataAlternative
                  chart="Carta de controle"
                  factor={factor}
                  table={tables["Carta de controle"]}
                />
              </div>
            </section>
          )}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <section
            aria-label="Resumo do período"
            className={`${cardClass} p-5`}
          >
            <CardHeader
              title="Resumo do período"
              subtitle="Gerado por IA · revisão humana necessária"
              action={
                <span className="rounded-md bg-accent p-1.5 text-accent-foreground">
                  <Sparkles size={16} />
                </span>
              }
            />
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              Unidade Marília. {periodSummary}
            </p>
            <Button
              variant="secondary"
              icon={Copy}
              className="mt-5"
              onClick={copy}
            >
              Copiar para e-mail
            </Button>
          </section>
          <section
            aria-label="Insight e ação recomendada"
            className="rounded-xl border border-brand-soft bg-accent p-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={17} className="text-accent-foreground" />
              {tab === "Jack-Knife"
                ? "Ação recomendada"
                : "Um insight para agir"}
            </div>
            <p className="mt-4 text-lg font-semibold leading-snug">
              {tab === "Jack-Knife"
                ? "Priorize os equipamentos na zona crítica."
                : tab === "Acompanhamento de Paradas"
                  ? "29,3% menos parada nos últimos 3 meses."
                  : "3 causas concentram 80% das falhas."}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-gray-600">
              Revisar os conjuntos mecânicos e sensores da Rotuladora pode
              reduzir recorrências. Valide a recomendação com o histórico
              técnico.
            </p>
          </section>
        </div>
      </div>
      {createPortal(
        <AnimatePresence>
          {filterOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFilterOpen(false)}
                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs"
              />
              <motion.div
                ref={drawerRef}
                initial={{ x: -360 }}
                animate={{ x: 0 }}
                exit={{ x: -360 }}
                transition={{ duration: 0.25 }}
                role="dialog"
                aria-modal="true"
                aria-label="Filtros de análise"
                className="fixed inset-y-0 left-0 z-50 flex w-[360px] max-w-full flex-col overflow-y-auto bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-border p-6">
                  <h2
                    tabIndex={-1}
                    className="flex items-center gap-2 text-lg font-semibold"
                  >
                    <SlidersHorizontal size={19} />
                    Filtros da análise
                  </h2>
                  <button
                    onClick={() => setFilterOpen(false)}
                    aria-label="Fechar filtros"
                    className="p-2"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Período"
                      value={draft.period}
                      onChange={(value) => setFilter("period", value)}
                      options={["Setembro", "Agosto", "Julho"]}
                    />
                    <Select
                      label="Ano"
                      value={draft.year}
                      onChange={(value) => setFilter("year", value)}
                      options={["2026", "2025", "2024"]}
                    />
                  </div>
                  <Select
                    label="Máquina"
                    value={draft.machine}
                    onChange={(value) => setFilter("machine", value)}
                    options={[
                      "Todas as máquinas",
                      ...machines.map((item) => item.name),
                    ]}
                  />
                  <Select
                    label="Linha"
                    value={draft.line}
                    onChange={(value) => setFilter("line", value)}
                    options={[
                      "Todas as linhas",
                      "Linha 1",
                      "Linha 2",
                      "Linha 3",
                    ]}
                  />
                  <Select
                    label="Turno"
                    value={draft.shift}
                    onChange={(value) => setFilter("shift", value)}
                    options={[
                      "Todos os turnos",
                      "1º turno",
                      "2º turno",
                      "3º turno",
                    ]}
                  />
                  <fieldset>
                    <legend className="mb-3 text-xs font-semibold text-gray-600">
                      Criticidade
                    </legend>
                    <div className="flex gap-3">
                      {["A", "B", "C"].map((item) => (
                        <button
                          key={item}
                          aria-pressed={draft.critical.includes(item)}
                          onClick={() =>
                            setDraft((previous) => ({
                              ...previous,
                              critical: previous.critical.includes(item)
                                ? previous.critical.filter(
                                    (value) => value !== item,
                                  )
                                : [...previous.critical, item],
                            }))
                          }
                          className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold ${
                            draft.critical.includes(item)
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-input text-[#596270]"
                          }`}
                        >
                          {draft.critical.includes(item) && <Check size={13} />}
                          {item}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Button
                    variant="secondary"
                    icon={Plus}
                    className="w-full"
                    onClick={() => {
                      setSaved((previous) => [
                        ...previous,
                        {
                          name: `${draft.period} · ${draft.line} · ${saved.length + 1}`,
                          filters: { ...draft },
                        },
                      ])
                      notify("Filtro salvo para as próximas análises.")
                    }}
                  >
                    Salvar filtro atual
                  </Button>
                  <div className="border-t border-border pt-5">
                    <p className="mb-3 text-xs font-semibold">
                      Meus filtros salvos
                    </p>
                    {saved.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => setDraft(item.filters)}
                        className="mb-2 flex min-h-11 w-full items-center justify-between rounded-lg bg-gray-50 px-3 text-left text-xs text-gray-600 hover:bg-accent"
                      >
                        {item.name}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-auto flex gap-3 border-t border-border p-6">
                  <Button
                    variant="secondary"
                    onClick={() => setDraft(defaultFilters)}
                  >
                    Limpar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setFilters(draft)
                      setFilterOpen(false)
                      notify("Filtros aplicados à análise.")
                    }}
                  >
                    Aplicar filtros
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
      {exportOpen && (
        <Modal
          title="Compartilhar análise"
          onClose={() => setExportOpen(false)}
        >
          <p className="mb-5 text-sm text-gray-600">
            Exporte o recorte atual da Unidade Marília com os gráficos, o resumo
            e a conferência SAP.
          </p>
          <Button
            variant="secondary"
            icon={Download}
            className="w-full"
            onClick={() => {
              notify(
                "Exportação PowerPoint simulada: apresentação preparada para revisão.",
              )
            }}
          >
            Exportar PowerPoint · demonstração
          </Button>
          <div className="my-6 border-t border-border" />
          <AccessibleForm
            onSubmit={(event) => {
              event.preventDefault()
              notify(
                `Envio para ${email} simulado. Nenhum e-mail real foi enviado.`,
              )
              setExportOpen(false)
            }}
          >
            <label htmlFor="export-email" className="text-xs font-semibold">
              Enviar para e-mail corporativo
              <input
                id="export-email"
                name="email"
                required
                aria-required="true"
                pattern="[^\s@]+@kof\.com"
                aria-describedby="export-email-hint"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
            <p
              id="export-email-hint"
              className="mt-2 text-xs text-muted-foreground"
            >
              Destinatários autorizados: @kof.com
            </p>
            <Button icon={Send} className="mt-5 w-full" type="submit">
              Enviar análise · demonstração
            </Button>
          </AccessibleForm>
        </Modal>
      )}
    </>
  )
}
