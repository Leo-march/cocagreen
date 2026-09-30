import SimpleTable from "@/components/tables/SimpleTable"
import { buildChartTable } from "@/domain/analytics"

export default function ChartDataAlternative({
  chart,
  factor = 1,
  critical = ["A", "B", "C"],
  table,
}: {
  table: ReturnType<typeof buildChartTable>
  chart: string
  factor?: number
  critical?: string[]
}) {
  if (chart === "Mapa de calor" || factor === 0) return null
  const { headings, rows } = table
  return (
    <details className="mt-5 rounded-lg border border-border bg-gray-50/50">
      <summary className="min-h-10 cursor-pointer rounded-lg px-4 py-3 text-xs font-semibold text-[#42454e]">
        Ver dados em tabela · {chart}
        {chart === "Barras empilhadas por criticidade"
          ? ` · ${critical.join(" / ")}`
          : ""}
      </summary>
      <SimpleTable
        caption={`Dados do gráfico: ${chart}`}
        headings={headings}
        rows={rows}
      />
    </details>
  )
}
