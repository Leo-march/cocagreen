import { buildAnalysisReport } from "@/domain/analytics"
import { type AnalysisFilters, type AnalyticsSource } from "@/types/maintenance"
import { useMemo } from "react"

export function useAnalysisReport(
  source: AnalyticsSource,
  filters: AnalysisFilters,
) {
  return useMemo(() => buildAnalysisReport(source, filters), [source, filters])
}
