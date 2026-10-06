import type { AnalyticsSource } from "@/types/maintenance"

export function buildHomeReport(
  source: AnalyticsSource,
  period: string,
  line: string,
) {
  const data = source.weekData.map((item) => ({
    ...item,
    falhas:
      period === "Semana anterior"
        ? item.anterior
        : line === "Todas as linhas"
          ? item.falhas
          : Math.ceil(item.falhas / 3),
  }))
  return {
    data,
    weeklyFailures: data.reduce((total, item) => total + item.falhas, 0),
    monthlyFailures: source.paretoData.reduce(
      (total, item) => total + item.ocorrencias,
      0,
    ),
  }
}
