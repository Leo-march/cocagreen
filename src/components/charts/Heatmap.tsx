import { weekdays } from "@/config/analysis"
import { type ChartModels } from "@/domain/analytics"
import { heatmapCellColors } from "@/utils/chartColors"

export default function Heatmap({ model }: { model: ChartModels["heatmap"] }) {
  const { values, minimum, maximum } = model
  return (
    <div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Mapa de calor em tabela rolável"
        className="overflow-x-auto"
      >
        <div className="flex min-w-[620px] items-end gap-5">
          <table className="w-full table-fixed border-collapse text-center">
            <caption className="sr-only">
              Minutos de parada por turno e dia da semana — Unidade Marília.
              Escala contínua de {minimum} a {maximum} min. Quanto mais escuro,
              maior o tempo de parada.
            </caption>
            <colgroup>
              <col className="w-24" />
              {weekdays.map((day) => (
                <col key={day} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="pb-3 text-left text-xs font-medium text-muted-foreground"
                >
                  Turno
                </th>
                {weekdays.map((day) => (
                  <th
                    scope="col"
                    key={day}
                    className="pb-3 text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {values.map((row, index) => (
                <tr key={index}>
                  <th
                    scope="row"
                    className="h-20 whitespace-nowrap pr-4 text-left text-xs font-medium text-muted-foreground"
                  >
                    {index + 1}º turno
                  </th>
                  {row.map((value, column) => (
                    <td
                      key={column}
                      style={heatmapCellColors(value, minimum, maximum)}
                      className="h-20 p-0 text-[11px] font-normal"
                    >
                      {value} min
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div
            aria-hidden="true"
            className="flex h-60 shrink-0 items-stretch gap-2"
          >
            <div className="w-3 bg-linear-to-b/srgb from-(--heatmap-end) to-(--heatmap-start)" />
            <div className="flex flex-col justify-between py-0.5 text-[11px] text-muted-foreground">
              <span>{maximum} min</span>
              <span>{minimum} min</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Maior concentração: 2º turno, quarta-feira — {values[1][2]} min.
      </p>
    </div>
  )
}
