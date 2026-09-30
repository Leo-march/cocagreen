import { type ReactNode } from "react"

export default function SimpleTable({
  headings,
  rows,
  caption,
}: {
  headings: string[]
  rows: ReactNode[][]
  caption?: string
}) {
  return (
    <div
      className="overflow-x-auto rounded-md"
      tabIndex={0}
      role="region"
      aria-label={caption || "Tabela de " + headings.join(", ")}
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          {caption || "Dados de " + headings.join(", ")}
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-[#596270]">
            {headings.map((heading) => (
              <th key={heading} scope="col" className="px-4 py-3 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b border-border last:border-0 hover:bg-gray-50"
            >
              {row.map((value, column) => (
                <td key={column} className="px-4 py-4 text-xs">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
