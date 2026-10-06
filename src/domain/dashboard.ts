export type DashboardRow = Record<string, unknown>

export type DashboardRecord = {
  machine: string
  date: string
  minutes: number
  line: string
}

function value(row: DashboardRow, ...keys: string[]) {
  for (const key of keys) {
    const found = row[key]

    if (
      found !== undefined &&
      found !== null &&
      String(found).trim() !== ""
    ) {
      return String(found)
    }
  }

  return ""
}

function numberValue(row: DashboardRow, ...keys: string[]) {
  const raw = value(row, ...keys).replace(",", ".").trim()
  const number = Number(raw)

  return Number.isFinite(number) ? number : 0
}

export function normalizeDashboardRows(
  rows: DashboardRow[],
): DashboardRecord[] {
  return rows.map((row) => ({
    machine: value(
      row,
      "chave_do_parada",
      "maquina",
      "machine",
      "equipamento",
    ),
    date: value(row, "data_inicio_real", "data", "date"),
    minutes: numberValue(row, "total_minutos", "minutos", "minutes"),
    line: value(row, "linha", "line"),
  }))
}

export function buildDashboardReport(
  records: DashboardRecord[],
  start: string,
  period: string,
  line: string,
) {
  const startDate = new Date(`${start}T00:00:00`)

  if (period === "Semana anterior") {
    startDate.setDate(startDate.getDate() - 7)
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const filtered = records.filter((record) => {
    if (line !== "Todas as linhas" && record.line !== line) {
      return false
    }

    const date = new Date(record.date.replace(" ", "T"))

    return date >= startDate && date < endDate
  })

  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

  const data = days.map((day, index) => {
    const dayStart = new Date(startDate)
    dayStart.setDate(startDate.getDate() + index)

    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)

    const falhas = filtered.filter((record) => {
      const date = new Date(record.date.replace(" ", "T"))

      return date >= dayStart && date < dayEnd
    }).length

    return {
      day,
      falhas,
      anterior: 0,
    }
  })

  return {
    data,
    weeklyFailures: filtered.length,
    monthlyFailures: records.filter((record) => {
      if (line !== "Todas as linhas" && record.line !== line) {
        return false
      }

      const date = new Date(record.date.replace(" ", "T"))

      return (
        date.getFullYear() === startDate.getFullYear() &&
        date.getMonth() === startDate.getMonth()
      )
    }).length,
  }
}
