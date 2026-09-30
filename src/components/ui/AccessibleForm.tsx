import {
  type FormHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export default function AccessibleForm({
  onSubmit,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const formId = useId()
  const [controls, setControls] = useState<{
    field: FormControl
    label: HTMLLabelElement
    name: string
    id: string
  }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    const fields = Array.from(
      formRef.current?.querySelectorAll<FormControl>(
        "input:not([type=file]), select, textarea",
      ) || [],
    )
    setControls(
      fields.flatMap((field, index) => {
        const label = field.labels?.[0]
        if (!label) return []
        field.id ||= `${formId}-field-${index}`
        label.htmlFor = field.id
        if (field.required) field.setAttribute("aria-required", "true")
        const name = (
          label.childNodes[0]?.textContent ||
          field.name ||
          "Campo"
        ).trim()
        return [{ field, label, name, id: field.id }]
      }),
    )
  }, [formId])
  useEffect(() => {
    controls.forEach(({ field, id }) => {
      const described = (field.getAttribute("aria-describedby") || "")
        .split(" ")
        .filter((value) => value && value !== `${id}-error`)
      if (errors[id]) {
        field.setAttribute("aria-invalid", "true")
        described.push(`${id}-error`)
      } else field.removeAttribute("aria-invalid")
      if (described.length)
        field.setAttribute("aria-describedby", described.join(" "))
      else field.removeAttribute("aria-describedby")
    })
  }, [controls, errors])
  return (
    <form
      {...props}
      ref={formRef}
      noValidate
      onChangeCapture={(event) => {
        const id = (event.target as unknown as HTMLElement).id
        if (errors[id])
          setErrors((previous) => {
            const next = { ...previous }
            delete next[id]
            return next
          })
      }}
      onSubmit={(event) => {
        const next: Record<string, string> = {}
        controls.forEach(({ field, name, id }) => {
          if (
            field.disabled ||
            ("readOnly" in field && field.readOnly) ||
            field.validity.valid
          )
            return
          next[id] = field.validity.valueMissing
            ? `${name}: preencha este campo para continuar.`
            : field.validity.typeMismatch
              ? `${name}: informe um endereço de e-mail válido.`
              : field.validity.patternMismatch
                ? `${name}: use um endereço corporativo com @kof.com.`
                : `${name}: confira o formato e informe um valor válido.`
        })
        setErrors(next)
        if (Object.keys(next).length) {
          event.preventDefault()
          requestAnimationFrame(() => summaryRef.current?.focus())
          return
        }
        onSubmit?.(event)
      }}
    >
      {Object.keys(errors).length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          aria-labelledby={`${formId}-errors-title`}
          className="mb-5 rounded-lg border border-red-700 bg-red-50 p-4"
        >
          <p
            id={`${formId}-errors-title`}
            className="text-sm font-semibold text-red-900"
          >
            Revise os campos para continuar
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-xs text-red-900">
            {controls
              .filter(({ id }) => errors[id])
              .map(({ id, name, field }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="text-left underline"
                    onClick={() => field.focus()}
                  >
                    {name}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {children}
      {controls.map(({ field, label, id }) =>
        createPortal(
          <>
            {field.required && (
              <span className="mt-1 block text-[11px] font-normal text-[#42454e]">
                Obrigatório
              </span>
            )}
            {errors[id] && (
              <p
                id={`${id}-error`}
                className="mt-2 text-xs font-semibold text-red-800"
              >
                {errors[id]}
              </p>
            )}
          </>,
          label,
          id,
        ),
      )}
    </form>
  )
}
