import { graphOptions } from "@/config/analysis"
import { inputClass } from "@/config/styles"
import { ChevronDown } from "lucide-react"
import { useId } from "react"

export default function Select({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  className?: string
}) {
  const selectId = useId()
  return (
    <div className={`block ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-xs font-semibold text-gray-600"
        >
          {label}
        </label>
      )}
      {!label && (
        <label htmlFor={selectId} className="sr-only">
          {graphOptions.includes(options[0])
            ? "Tipo de gráfico"
            : options[0] === "Esta semana"
              ? "Período"
              : options[0]}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`${inputClass} appearance-none pr-9`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-3.5 text-[#596270]"
          size={14}
        />
      </div>
    </div>
  )
}
