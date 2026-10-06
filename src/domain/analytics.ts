import {
  type AnalysisFilters,
  type AnalyticsSource,
  type ParetoPoint,
  type SeriesPoint,
  type JackKnifePoint,
} from "@/types/maintenance"

import { graphOptions } from "@/config/analysis"

export const criticalWeights: Record<string, number> = {
  A: 0.48,
  B: 0.32,
  C: 0.2,
}

export function stackedSeries(series: SeriesPoint[], critical: string[]): {
  month: string
  minutes: Record<string, number>
}[] {
  return series.map((item) => {
    const breakdown: Record<string, number> = { A: 0, B: 0, C: 0 }
    const weight = critical.reduce(
      (total, value) => total + criticalWeights[value],
      0,
    )
    let remaining = item.realizado
    critical.forEach((value, index) => {
      const minutes =
        index === critical.length - 1
          ? remaining
          : Math.min(
              remaining,
              Math.round((item.realizado * criticalWeights[value]) / weight),
            )
      breakdown[value] = minutes
      remaining -= minutes
    })
    return { month: item.month, minutes: breakdown }
  })
}

export function jackKnifePoints(source: JackKnifePoint[], factor: number) {
  return source.map((point) => ({
    ...point,
    x: Math.max(1, Math.round(point.x * Math.max(factor, 0.1))),
  }))
}

export function controlSeries(source: number[], factor: number) {
  return source.map((value, index) => ({
    day: `${index + 1}`,
    value: Math.round(value * factor),
  }))
}

export function waterfallSource(
  source: AnalyticsSource["waterfall"],
  factor = 1,
) {
  const first = Math.round(source.first * factor)
  const last = Math.round(source.last * factor)
  let current = first
  const changes = source.changes
    .map((item) => ({ ...item, delta: Math.round(item.delta * factor) }))
    .map((item) => {
      const next = current + item.delta
      const point = {
        ...item,
        base: Math.min(current, next),
        value: Math.abs(item.delta),
        total: false,
      }
      current = next
      return point
    })
  return [
    {
      cause: source.firstLabel,
      base: 0,
      value: first,
      delta: first,
      total: true,
    },
    ...changes,
    {
      cause: source.remainderLabel,
      base: Math.min(current, last),
      value: Math.abs(last - current),
      delta: last - current,
      total: false,
    },
    { cause: source.lastLabel, base: 0, value: last, delta: last, total: true },
  ]
}

export function buildAnalysisReport(
  source: AnalyticsSource,
  filters: AnalysisFilters,
) {
  const factor =
    (filters.line === "Todas as linhas" ? 1 : 0.35) *
    (filters.shift === "Todos os turnos" ? 1 : 0.4) *
    (filters.machine === "Todas as máquinas" ? 1 : 0.3) *
    (filters.period === "Setembro"
      ? 1
      : filters.period === "Agosto"
        ? 1.2
        : 1.42) *
    (filters.year === "2026" ? 1 : 1.3) *
    filters.critical.reduce(
      (total, critical) => total + criticalWeights[critical],
      0,
    )
  const analysisData = source.paretoData.map((item) => ({
    ...item,
    ocorrencias: Math.round(item.ocorrencias * factor),
    projecao: Math.round(item.projecao * factor),
  }))
  const occurrenceTotal = analysisData.reduce(
    (total, item) => total + item.ocorrencias,
    0,
  )
  let accumulated = 0
  analysisData.forEach((item) => {
    accumulated += item.ocorrencias
    item.acumulado = occurrenceTotal
      ? Math.round((accumulated / occurrenceTotal) * 1000) / 10
      : 0
  })
  const series = source.trendData.map((item) => ({
    ...item,
    realizado: Math.round(item.realizado * factor),
    meta: Math.round(item.meta * factor),
    projecao: Math.round(item.projecao * factor),
  }))
  const periodSummary =
    factor === 1
      ? source.summaryText
      : `No recorte selecionado, foram registrados ${Math.round(source.waterfall.last * factor)} min de parada e ${occurrenceTotal} ocorrências. ${filters.line}, ${filters.shift.toLowerCase()}. As causas mecânicas continuam sendo o principal foco de atenção. Dados de demonstração para revisão do fluxo.`

  const models = buildChartModels(
    source,
    factor,
    series,
    analysisData,
    filters.critical,
  )
  const tables = Object.fromEntries(
    graphOptions.map((chart) => [
      chart,
      buildChartTable(
        chart,
        analysisData,
        series,
        factor,
        filters.critical,
        models,
      ),
    ]),
  )
  const downtimeMinutes = Math.round(source.waterfall.last * factor)
  return {
    factor,
    analysisData,
    occurrenceTotal,
    series,
    periodSummary,
    models,
    tables,
    downtimeMinutes,
  }
}

export function buildChartModels(
  source: AnalyticsSource,
  factor: number,
  series: SeriesPoint[],
  data: ParetoPoint[],
  critical: string[],
) {
  const points = jackKnifePoints(source.jackKnifeData, factor)
  const grouped = [
    ...data
      .slice(0, 3)
      .map((item) => ({ cause: item.cause, ocorrencias: item.ocorrencias })),
    {
      cause: "Outras",
      ocorrencias: data
        .slice(3)
        .reduce((total, item) => total + item.ocorrencias, 0),
    },
  ]
  const values = source.heatmapValues.map((row) =>
    row.map((value) => Math.round(value * factor)),
  )
  return {
    grouped,
    latestSeries: series[series.length - 1],
    treemap: grouped.map((item) => ({
      name: item.cause,
      value: item.ocorrencias,
    })),
    stacked: stackedSeries(series, critical).map((item) => ({
      month: item.month,
      ...item.minutes,
      minutes: item.minutes,
    })),
    jackKnife: {
      points,
      meanX:
        points.reduce((total, point) => total + point.x, 0) / points.length,
      meanY:
        points.reduce((total, point) => total + point.y, 0) / points.length,
    },
    control: {
      data: controlSeries(source.controlValues, factor).map((item) => ({
        ...item,
        outsideLimit: item.value > 60 * factor,
      })),
      mean: 40 * factor,
      lowerLimit: 20 * factor,
      upperLimit: 60 * factor,
      domainMaximum: Math.max(80 * factor, 10),
      outlierDay: "6",
      outlierMinutes: Math.round(source.controlValues[5] * factor),
    },
    heatmap: {
      values,
      minimum: Math.min(...values.flat()),
      maximum: Math.max(...values.flat()),
    },
    waterfall: waterfallSource(source.waterfall, factor),
  }
}

export type ChartModels = ReturnType<typeof buildChartModels>

export function buildChartTable(
  chart: string,
  data: ParetoPoint[],
  series: SeriesPoint[],
  factor: number,
  critical: string[],
  models: ChartModels,
) {
  let headings: string[] = []
  let rows: (string | number)[][] = []
  const number = (value: number) =>
    value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  if (chart === "Pareto") {
    headings = ["Causa", "Ocorrências", "Projeção IA", "Acumulado"]
    rows = data.map((item) => [
      item.cause,
      item.ocorrencias,
      item.projecao,
      `${number(item.acumulado)}%`,
    ])
  } else if (["Rosca", "Treemap"].includes(chart)) {
    headings = ["Causa", "Ocorrências"]
    rows = [
      ...data.slice(0, 3),
      {
        cause: "Outras",
        ocorrencias: data
          .slice(3)
          .reduce((total, item) => total + item.ocorrencias, 0),
      },
    ].map((item) => [item.cause, item.ocorrencias])
  } else if (chart === "Jack-Knife") {
    headings = ["Máquina", "Frequência de falhas", "MTTR"]
    rows = models.jackKnife.points.map((item) => [
      item.name,
      number(item.x),
      `${number(item.y)} h`,
    ])
  } else if (chart === "Carta de controle") {
    headings = ["Dia", "Parada", "Média", "Limite inferior", "Limite superior"]
    rows = models.control.data.map((item) => [
      item.day,
      `${item.value} min`,
      `${number(models.control.mean)} min`,
      `${number(models.control.lowerLimit)} min`,
      `${number(models.control.upperLimit)} min`,
    ])
  } else if (chart === "Cascata") {
    headings = ["Período / causa", "Variação", "Natureza"]
    rows = models.waterfall.map((item) => [
      item.cause,
      `${
        item.total ? "" : item.delta > 0 ? "+" : "−"
      }${number(Math.abs(item.delta))} min`,
      item.total ? "Total do período" : item.delta > 0 ? "Aumento" : "Redução",
    ])
  } else if (chart === "Barras empilhadas por criticidade") {
    headings = [
      "Mês",
      ...critical.map((value) => `Criticidade ${value}`),
      "Total",
    ]
    rows = models.stacked.map((item) => [
      item.month,
      ...critical.map((value) => `${item.minutes[value]} min`),
      `${critical.reduce((total, value) => total + item.minutes[value], 0)} min`,
    ])
  } else {
    headings = ["Mês", "Realizado", "Meta", "Projeção IA"]
    rows = series.map((item) => [
      item.month,
      `${item.realizado} min`,
      `${item.meta} min`,
      `${item.projecao} min`,
    ])
  }

  return { headings, rows }
}
