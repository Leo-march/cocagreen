import { inputClass } from "@/config/styles"
import { useId } from "react"

export default function Field({
  label,
  name,
  placeholder,
  type = "text",
  defaultValue,
  required = true,
  value,
  onChange,
}: {
  label: string
  name: string
  placeholder?: string
  type?: string
  defaultValue?: string
  required?: boolean
  value?: string
  onChange?: (value: string) => void
}) {
  const fieldId = useId()
  return (
    <label
      htmlFor={fieldId}
      className="block text-xs font-semibold text-gray-600"
    >
      {label}
      <input
        id={fieldId}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        required={required}
        aria-required={required || undefined}
        autoComplete={
          type === "email" ? "email" : name === "name" ? "name" : undefined
        }
        pattern={type === "email" ? "[^\\s@]+@kof\\.com" : undefined}
        aria-describedby={type === "email" ? `${fieldId}-hint` : undefined}
        className={`${inputClass} mt-2`}
      />
      {type === "email" && (
        <span
          id={`${fieldId}-hint`}
          className="mt-2 block text-xs font-normal text-[#42454e]"
        >
          Use seu endereço corporativo @kof.com.
        </span>
      )}
    </label>
  )
}
